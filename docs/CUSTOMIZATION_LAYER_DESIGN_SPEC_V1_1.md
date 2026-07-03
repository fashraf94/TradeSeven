# Customization Layer Design Spec — V1.1

**Date:** July 3, 2026
**Status:** Locked pending Flash sign-off (adversarial review incorporated)
**Owner:** Flash · **Author:** Claude (Architecture) · **Adversarial review:** ChatGPT (July 3, 2026)
**Gated on:** `CUSTOMIZATION_LAYER_AUDIT_REPORT_JUL2026` (CC discovery — hypothesis PARTIALLY SUPPORTED)
**Companions:** `FORGE_RULES_THESIS_V1_2.md` (§9.5 ladder — extended here), six `ARCHETYPE_DEF_*_2026-06-24` docs, `FORGE_ENFORCEMENT_KEYSTONE_SPEC_V1_4.md`, `ARCHETYPE_INTEGRITY_POST_LAUNCH_BACKLOG_2026-06-25.md`
**Supersedes:** V1.0 (July 3, 2026) in full; `AGENT_DNA_TRAITS_SYSTEM_SPEC_V2.md` as roadmap (shipped Option A plumbing unaffected)

### V1.1 Changelog (ChatGPT review integration)

| # | Change | Section |
|---|---|---|
| 1 | Tighten-only split: **tighten-only** for rung-3 hard constraints; **core-safe bounded modulation** for rung-4 dials | §2.1 |
| 2 | WS2 scoring mechanics moved entirely into the Tier 2 fence bundle; battle-locked live-read option deleted; receipt provenance is a **WS2 blocker**, new `'user_dial'` enum (not `'user_rule'`) | §5, §3 |
| 3 | Grandfathering replaced with **pre-launch cleanup** (one-time demote + badge script) | §4.3 |
| 4 | Hard-promote block: fence-lite review; enumerated write-path coverage; enforcement-stack reality (client-direct Firestore); authoritative backstop question routed to WS1 discovery | §4.3–4.4 |
| 5 | Taxonomy: internal `needs_review` state + `tensionReason` metadata; ambiguous never defaults to `neutral`; per-rule adjudication mandatory for high-risk sets | §4.2 |
| 6 | WS3 marked **not behaviorally shipped** until decision-prompt reflects precedence; prompt piece presumed fenced → Tier 2 bundle; watched-collapsing-name test as blocking invariant across both assemblies | §6 |
| 7 | Lean-vs-directive conflict: opposition-pairs map + explicit one-battle override confirmation + voice acknowledgment + observe logging; `leanEffectType` taxonomy deferred to Phase 2 pending observe data | §7.4 |
| 8 | Adjustment versioning policy (semantic change → new id + re-confirmation; wording edit reuses id) | §7.2 |
| 9 | Combination-safety test matrix added (allowlist proves single-entry safety, not combination safety) | §7.6 |
| 10 | Calibration acceptance criteria defined as WS2's exit gate (incl. cross-archetype ordering invariant) | §5.2 |
| 11 | One fence authorization, **split commits/PRs** by concern | §7.3 |
| 12 | Risk-posture dial deferred to V1.5 | §5.4 |
| 13 | §11 converted to resolved review log + remaining Flash decisions | §11 |

---

## 1. Purpose

Parent design document for user customization on top of the archetype foundation. Locks the model, precedence rules, workstream boundaries, and the fence-authorization map. **Not** a CC build prompt — each workstream gets its own phased build spec.

The strategic decision this implements: **refine, not replace.** The archetype identity system (six four-zone definitions + adjustment-menu allowlists + Stream D physics) is the substrate. Customization is rebuilt on it in two families and shipped in two tiers, priced by the audit and hardened by the adversarial review.

### 1.1 The one-paragraph model

A user customizes their agent along two families of controls. **Identity-orthogonal dials** change *how much / where / how fast* without ever touching *what the agent believes*: research focus, trade tempo, (later) risk posture and communication style. **Identity-native leans** change *flavor within the philosophy*: standing selections from the archetype's adjustment menu (46 typed adjustments, all `coreAlignment:'reinforces'`). The archetype's immutable core outranks everything a user can equip; every dial is banded per-archetype; every lean is allowlisted per-archetype. Customization can tighten, flavor, or modulate an archetype within core-safe bounds. It can never dissolve one.

### 1.2 Audit facts this design is built on

| # | Fact (VERIFIED unless noted) | Design consequence |
|---|---|---|
| 1 | `archetypeAdjustments.js`: clean, single-source, non-fenced; 46 adjustments; zero core-reversing entries | Leans need no new classification machinery for **single entries** (combination safety is separately tested — §7.6) |
| 2 | Stream D V1.4 merged and evolved on main; knobs archetype-locked; non-fenced choke point `agent-evaluate.js:~1002` | Tempo dial clamp layer lives at the choke point — but ships inside the Tier 2 bundle (§5) |
| 3 | Standing-lean persistence hits two fenced points: snapshot write (`agentBattleService.js:150`), eval read (`agentEvalPromptAssembly.js:936`) | Standing leans are Tier 2, one bundled fence authorization |
| 4 | Rule equip path archetype-blind end-to-end; ~20–45 contradicting templates per archetype; hardness override can promote contradictions into `CONSTRAINTS (must obey)` | WS1 is the urgent workstream — the equip-path twin of the integrity build |
| 5 | Four of five axes dual-claimed; `tradeFrequency`, `sectorConcentrationCap`, `defaultConfig.risk` dead/seed-only | Ladder resolves A–D; dead fields DO-NOT-REUSE |
| 6 | `ARCHETYPE_INTEGRITY_MODE = 'observe'`; directives persist only under `enforce` | Tier 2 gated on the enforce flag walk |
| 7 | Traits: Option A plumbing live; no archetype field in trait objects; seeder (`ARCHETYPE_DEFAULT_TRAITS`) is the live archetype→default-rules wire | Soft-retire picker, keep seeder, kits post-launch |
| 8 | Knob values are uncalibrated launch seeds ("ILLUSTRATIVE") | WS2 gated on calibration acceptance criteria (§5.2) |
| 9 | Rule docs are written **client-direct to Firestore**; Firestore rules cannot import data modules | Shapes the hard-promote enforcement stack (§4.4) |

---

## 2. The Global Precedence Ladder — Extension

Extends Forge Rules Thesis V1.2 §9.5. Every workstream's conflict semantics resolve against this ladder. Higher rung wins.

| Rung | Layer | Examples | Notes |
|---|---|---|---|
| 1 | Platform safety | Bust defense, `EMERGENCY_BYPASS_REASONS`, guardrail stop-loss/trailing-stop | Never overridable |
| 2 | Archetype immutable core (Zone 1) | TF "never buy weakness"; Diversifier 35% hard cap; Speculator "fundamentals irrelevant" | The identity floor — **bound-setting** (§2.1) |
| 3 | User hard constraints | `se-07` sector cap, user stop rules, hard-category equipped rules (post-scoping) | **Tighten-only** applies here |
| 4 | User dials & standing leans | Tempo dial, equipped leans, research focus | **Core-safe bounded modulation** applies here |
| 5 | Chat directives | `battle.directive` (single slot, battle-scoped) | Override semantics per §7.4 — no longer a casual outrank |
| 6 | Archetype tunable defaults | Knob seed values, `ARCHETYPE_WEIGHTS`, soft `ARCHETYPE_CONSTRAINTS`, temperatures | What dials/leans modulate |
| 7 | Preset base levers | `strategyPreset` → `getPresetConfig` | Precedence vs knobs already coded + test-locked |
| 8 | Soft prompt preferences | `STRATEGY PREFERENCES` rules, watchlist priority block | Haiku-discretionary |

### 2.1 Two principles, not one (V1.1 revision)

V1.0 generalized the Diversifier `min(user, 35%)` pattern into a universal tighten-only rule. The review correctly showed that is too broad: an "Aggressive" Capital Preserver is not tightening — it is **loosening within a core-safe band**, and that is legitimate. Encoding every dial as tighten-only would make tempo and risk behave strangely on the aggressive side. V1.1 splits the principle by rung:

**Rung 3 — Tighten-only (hard constraints).**
> A user hard constraint may raise the agent's bar or narrow its bounds within the core. It may never lower a bar below the core or widen past a core bound. Where user and core set the same kind of bound, the stricter wins (`min()` pattern).

**Rung 4 — Core-safe bounded modulation (dials & leans).**
> A dial or lean may move a tunable default in **either direction within its archetype-keyed band**. Bands are authored so that no position in the band violates a Zone 1 statement or a rung-1/2/3 bound. The band ceiling is the product answer to "I want more": past the ceiling, the answer is *change archetype*, not a wider dial.

Product posture confirmed: a Capital Preserver user who wants Speculator-grade aggression changes archetype. Dials express range *within* an identity, never a bridge *between* identities.

### 2.2 Axis-by-axis resolution (the four dual-claims)

**Axis A — Research / hunt.** Owner: archetype soft constraints (the fishing grounds). Second claimant: user watchlist priority block (`agentPromptAssembly.js:114`). **Resolution: watchlist = attention, not obligation.** Watched names get priority evaluation; core refusals still apply to them. A Trend Follower whose watchlist contains a collapsing name *surfaces* it, never buys it against style. Rung 4 for attention; never overrides rung 2. Behavioral shipping criterion in §6.

**Axis B — Tempo.** Owner: Stream D knobs (hard physics). Second claimant: `strategyPreset` base levers — precedence already coded and test-locked; unchanged. New entrant: the tempo dial (rung 4) = clamped multiplier on the *resolved* knob config, shipped in the Tier 2 bundle. `tradeFrequency` DEAD — DO-NOT-REUSE.

**Axis C — Risk.** Three-way today: preset levers, user hard rules (`checkSectorCap`, `agentGuardrails.js:496`), Diversifier core cap. **Resolution: core bound (2) > user hard rule (3) > risk dial (4, deferred V1.5) > preset levers (7).** `defaultConfig.risk` CPU/seed only — DO-NOT-REUSE.

**Axis D — Sector lean.** Owner: archetype weights/constraints (soft) + user hard caps (rung 3). **Resolution: no new generic sector-preference surface** — sector flavor is expressed only through identity-native leans and user hard caps. `sectorConcentrationCap` DEAD — DO-NOT-REUSE.

**Axis E — Comms.** Single-owned; chat budget governs count (orthogonal). Verbosity/style dial parked for the voice-layer arc.

---

## 3. The two-tier build map (V1.1 revision)

| Tier | Workstream | Fence | Gate | Urgency |
|---|---|---|---|---|
| 1 | WS1 — Rule-library archetype scoping | None, but hard-promote block gets **fence-lite review** (§4.4) | None | **Highest — pre-launch identity hole** |
| 1 | WS3 — Research-focus precedence, **voice piece only** (not behaviorally shipped) | None | None | Small; anytime |
| 2 | WS2 — Tempo dial (snapshot + clamp + receipts, as one) | In bundle | Calibration acceptance (§5.2) + enforce walk | Post-gates |
| 2 | WS4 — Standing leans | In bundle | Enforce walk | Post-walk |
| 2 | WS3 — prompt-assembly piece (presumed fenced) | In bundle | Enforce walk | With bundle |

**V1.1 structural change:** nothing scoring-affecting ships outside the fence bundle. The review's core argument — "temporary" gaps must not touch scored behavior, and logs are not a substitute for receipt truth — is adopted as a design invariant:

> **Invariant S (score integrity):** No user customization control may influence a scored decision unless (a) its value is stamped in `battle.agentContext` at battle creation, and (b) receipts truthfully discriminate its provenance. Partial shipping of scoring-affecting mechanics is prohibited.

Consequences: the V1.0 battle-locked live-read option for the tempo dial is **deleted**; the receipt provenance "accepted gap" is **rescinded** and reclassified as a WS2 blocker. Tier 1 shrinks to the two non-scoring workstreams — which is fine, because WS1 is the urgent one anyway.

---

## 4. WS1 — Rule-library archetype scoping

### 4.1 Problem statement

A user can equip any of 143 templates onto any archetype, and via the per-rule hardness override (`projectActiveRules.js:80-90`) can promote a core-contradicting rule into `== CONSTRAINTS (must obey) ==`. This reproduces the identity-dissolution failure the integrity build fixed at the chat door — through the Forge door. The integrity gate never sees equipped rules.

### 4.2 The compatibility map

New single-source, zero-import-cost data module — `src/data/archetypeRuleCompatibility.js` — mirroring the `archetypeAdjustments.js` pattern. Not inline fields on the 143 templates.

**Shipped taxonomy (3 states):**

| State | Meaning | Equip behavior (V1) |
|---|---|---|
| `native` | Expresses or reinforces the archetype's core | Normal; optional "on-style" badge |
| `neutral` | Orthogonal to the core | Normal |
| `core_conflict` | Contradicts a Zone 1 statement | Soft warning at equip + observe log; **hardness promotion blocked** (§4.3) |

**Authoring taxonomy (V1.1 addition):** a fourth internal-only state, `needs_review`, with optional `tensionReason` reviewer metadata. **Ambiguous entries never default to `neutral`** — they sit in `needs_review` until adjudicated. **Shipping gate: the map ships with zero `needs_review` entries remaining.** `soft_tension` remains rejected as a user-facing state.

**Census methodology (V1.1 revision):** family-level classification is the default (conflicts cluster in families — mean-reversion, deep-value, high-volatility, concentration, forced-trading), **but per-rule adjudication is mandatory for the high-risk sets:**

1. Every rule in Capital Preserver's conflict-heavy families (the ~45-rule worst case)
2. Every hard-category rule (`risk`, `allocation`, + per-rule hard overrides)
3. Every rule eligible for hardness promotion
4. Every rule seeded by `ARCHETYPE_DEFAULT_TRAITS`
5. Every rule tagged concentration, deep value, high volatility, mean reversion, or forced trading

Authoring source of truth: Zone 1 statements in the six archetype definition docs, cross-checked against audit-verified live wires. The audit census table is the seed; the build spec includes the full family map + per-rule exception list as a fixture CC verifies against the live template library.

### 4.3 Enforcement posture — V1 (revised)

1. **Soft equip, hard promote.** Equipping a `core_conflict` rule → inline warning (mirrors `FORGE_CONFLICT_PAIRS` UX) + logged observe event. Promoting a `core_conflict` rule to hard → **blocked** with an explanatory message, across **every** write path (§4.4).
2. **Pre-launch cleanup, not grandfathering (V1.1 change).** V1.0's grandfathering was a post-launch courtesy applied to a pre-launch product. Since no launched users exist, WS1 includes a one-time cleanup script: (a) any `core_conflict` rule currently promoted to hard is **demoted to soft** (logged, reversible record kept); (b) all equipped `core_conflict` rules get the warning badge. Founder's own test agents are the only affected population. Post-launch, the grandfathering posture becomes the standing policy for future map *changes* (a reclassification never silently alters a live user's agent — it badges and notifies).
3. **Observe before filter.** V1 does not filter conflicts out of projection. Projection-time filtering is Phase 2, **presumed fenced** (V1.1: no longer an open question), taken up only after observe data shows real conflict-equip volume.

**WS1 Invariant R (runtime neutrality):** V1 changes no runtime/projection behavior except (a) preventing *new* `core_conflict` hard promotions and (b) the one-time pre-launch demotions. Blocking tests required: soft conflicting rules project unchanged; `core_conflict` rules cannot become hard through *any* path — direct rule edit, hardness override, trait strength profile, trait plumbing, seeding, or a pre-existing doc.

### 4.4 Enforcement stack and the fence posture (revised)

The review is right that a client-side block alone is cosmetic — and right that the hard-promote block is **decision-adjacent** regardless of file path, because it changes what can reach must-obey execution. V1.1 responses:

**Process:** the hard-promote block receives **fence-lite review** — the build spec presents the enumerated write-path coverage list for explicit approval before implementation, mirroring the fence map-approval flow even though the touched files are non-fenced. Phase 2 projection filtering is presumed fenced, full stop.

**Architecture reality (audit fact #9):** rule docs are written client-direct to Firestore; there is no server write endpoint for rule edits, and Firestore security rules cannot import the compatibility map. The honest enforcement stack is therefore:

| Layer | Mechanism | Status |
|---|---|---|
| L1 | Block at **every enumerated client write path** (rule edit, hardness override, trait strength write, equip service) | V1, required |
| L2 | Firestore-rules **structural** constraint — investigate whether a field-level rule can enforce a useful invariant without the map (e.g., hardness-override writes restricted to an allowlisted shape, or `core_conflict`-flagged docs — flag written at equip time — cannot carry `hard`) | **WS1 discovery question** — feasibility unknown |
| L3 | Projection-time backstop inside the decision path | Phase 2, presumed fenced |

L1 is convention-enforced (same class as the archetype battle-lock, audit backlog Item 1) and is acknowledged as such — which is exactly why L2 feasibility is a discovery question and L3 exists as the eventual authoritative backstop. The Firestore field-allowlist hardening pass (backlog Item 1) should cover rule-doc hardness fields when it runs.

### 4.5 Seeded-rule invariant

Build-spec acceptance test: **every rule seeded by `ARCHETYPE_DEFAULT_TRAITS` for archetype X classifies `native` or `neutral` for X.** Any seeded `core_conflict` → the build STOPs and surfaces it (bug in seed map or classification — a human adjudicates which).

---

## 5. WS2 — Tempo dial (Tier 2, revised)

### 5.1 Product shape (unchanged)

One 3-segment dial — `[ Measured | Standard | Aggressive ]` — reusing the shipped trait-strength interaction pattern. **Per-archetype bands** (core-safe bounded modulation, §2.1): the dial modulates the archetype's own *calibrated* knob values by clamped multipliers, so a Capital Preserver's "Aggressive" is still slower than a Speculator's "Measured."

### 5.2 Gates — calibration acceptance criteria (V1.1 addition)

"Calibration complete" is now defined. WS2 mechanics may not start until the knob-calibration workstream produces, and Flash accepts, a report showing:

1. Per-archetype baseline trade counts over the replay window(s)
2. Forced-rotation fire frequency per archetype
3. Emergency-bypass fire frequency (must be rare and reason-attributed)
4. Swap rejection rate at the hurdle floor per archetype
5. At least one stress replay (high-volatility window)
6. **Ordering invariant:** expected tempo order holds across archetypes (Speculator > Trend Follower > … > Capital Preserver) **and continues to hold at every dial position** once bands are drafted — i.e., Capital Preserver at Aggressive remains slower than Speculator at Measured

Band multipliers are authored *from* this report, never before it.

### 5.3 Mechanics (revised — snapshot-only)

The V1.0 battle-locked live-read option is deleted per Invariant S. The dial ships as one coherent Tier 2 unit:

- `agent.dials.tempo` on the agent doc (write path battle-locked in UI *and* covered by the field-allowlist hardening rider)
- **Stamped at battle creation** into `battle.agentContext.dials` (fenced edit — bundle item #1)
- Clamp layer at the non-fenced choke point (`agent-evaluate.js:~1002`) reads the **snapshotted** value and applies the multiplier to the resolved knob config
- **Merge, not replace:** the clamp layer emits a fully-populated config object so no downstream `?? default` silently reverts a dialed value — dedicated test required
- Emergency-bypass reasons and circuit-breaker safety semantics untouched — the dial modulates thresholds, never the rung-1 bypass set

### 5.4 Receipt provenance — blocker, not gap (revised)

Rescinding V1.0 §5.4. Receipts are the user-facing audit artifact; clamp-layer logs are not a substitute. Requirements:

- New enum value **`'user_dial'`** (or `'archetype_plus_user_dial'` if the builder distinguishes base-vs-modulated — build-spec discovery picks). **Do not reuse `'user_rule'`** — that value is reserved for Path 1 user-authored lever enforcement, a different provenance.
- The resolved config carries a provenance flag; `buildSwapReceiptSource` (fenced — bundle item #4) reads it.
- **Blocking test:** when `tempo != Standard`, receipt provenance must show dial involvement; when `tempo == Standard`, provenance remains `'archetype'`.
- Logs additionally capture resolved raw knob values + source chain, tied to `battleId` + receipt id.

### 5.5 Risk posture dial — deferred to V1.5 (revised)

V1.0 already made it conditional; V1.1 plans for the drop. A dial that maps to coarse preset-lever selection risks promising precision the system doesn't deliver. Risk posture returns as V1.5 **only if** calibration evidence shows preset levers produce legible, band-able behavior differences. Until then, risk customization = rung-3 hard rules (which already work).

---

## 6. WS3 — Research-focus precedence formalization (revised)

1. **Declared precedence in the decision prompt:** the watchlist priority block explicitly framed as *attention, not obligation*, subordinate to archetype constraints and core refusals. **Presumed fenced** (both prompt assemblies) → **bundle item #2/#3.**
2. **Voice piece (Tier 1):** surface-don't-buy narration — when a watched name fails the archetype's style, the agent narrates the tension rather than acting against style. Ships early as product copy.
3. **Not behaviorally shipped until the prompt piece lands (V1.1 change).** Voice narration does not protect decisions. WS3 is marked complete only when the decision prompt reflects the precedence.
4. **Blocking invariant test:** the watched-collapsing-name case — Trend Follower + watchlist name in collapse → agent surfaces and refuses to buy, with style explanation — verified against **both** `agentPromptAssembly.js` and `agentEvalPromptAssembly.js` (the stay-in-sync invariant becomes a test, not a comment).
5. **Scouting Board stays read-only**; the equipped watchlist remains the single research-focus lever; thematic focus pickers deferred to the Correlation/Universe Intelligence consumer arc.

---

## 7. WS4 — Standing leans (Tier 2)

### 7.1 Product shape

The adjustment menu, promoted from defensive gate to offensive surface. Per archetype, the user browses that archetype's allowlist (7–8 entries) and equips up to **2 standing leans** (cap confirmed by review) — persistent, cross-battle, battle-locked, drawn from `archetypeAdjustments.js`. Every option is `coreAlignment:'reinforces'` — the picker cannot present a *single-entry* identity attack; combination safety is separately tested (§7.6).

### 7.2 Data model + versioning (revised)

```
agent.standingLeans = [ { adjustmentId: 'TF-01', version: 1, equippedAt } ]
battle.agentContext.standingLeans = [ resolved canonical texts ]   // stamped at creation
```

Ids-only at rest (single source; no text duplication); resolved-text-at-stamp (stamp-not-flag — a menu rewording never mutates an in-flight battle).

**Versioning policy (V1.1 addition)** — battle snapshots protect in-flight battles but not user consent across seasons:

- Each adjustment gains `canonicalTextVersion`.
- **Wording-only edit** (meaning preserved): reuse id, bump nothing user-visible.
- **Semantic edit** (meaning changes): **deprecate the old id, mint a new id.** Equipped deprecated ids stop stamping into new battles and surface a re-confirmation prompt ("this lean has been revised — review and re-equip"). No silent meaning drift on a control the user consented to.

### 7.3 The fence-authorization map — one approval, split delivery (revised)

| # | File | Edit | For |
|---|---|---|---|
| 1 | `agentBattleService.js:150` (snapshot write) | Include resolved `standingLeans[]` + `dials` in `agentContext` | WS4 + WS2 |
| 2 | `agentEvalPromptAssembly.js:936-adjacent` | Standing-leans block alongside `battle.directive`; consume snapshotted dial; WS3 precedence language | WS4 + WS2 + WS3 |
| 3 | `agentPromptAssembly.js` | Sync with #2 (sync invariant becomes a test) | WS4 + WS3 |
| 4 | `agentRiskManager.js` (receipt builder ~:516-525) | Read provenance flag → emit `'user_dial'` | WS2 (§5.4) |

**One authorization package; split implementation (V1.1 change):** the four edits are approved together via the fence map-approval flow but land as **separate commits/PRs by concern** — (a) snapshot write, (b) prompt read/render ×2, (c) receipt provenance, (d) tests + fixtures — giving surgical rollback boundaries. Everything else in WS4 (Firestore writes, equip UI, battle-lock, id validation via `isValidAdjustmentId`) is non-fenced.

### 7.4 Conflict semantics — lean vs chat directive (revised)

V1.0's "chat directive casually outranks the lean" made leans decorative. V1.1 adopts explicit-override semantics, implemented lightly:

- **Structural context:** leans and chat directives draw from the *same* allowlist, so a "contradiction" is flavor-level opposition between two core-safe entries — never an identity attack. This is why a full `leanEffectType` type system is not needed in V1.
- **Mechanism:** a small `ADJUSTMENT_OPPOSITION_PAIRS` map in `archetypeAdjustments.js` (mirroring the `FORGE_CONFLICT_PAIRS` pattern) marks intra-menu opposites per archetype.
- **Behavior:** when an incoming chat directive opposes an equipped lean, the gate does not silently proceed. The agent surfaces it and requires **explicit one-battle override confirmation**: "That cuts against your standing lean *[canonical text]* — override it for this battle?" On confirm → directive governs for that battle, the lean is untouched and resumes next battle, and the voice acknowledges the state ("for this battle, you asked me to lean away from your standing setup"). On decline → directive is not written.
- **Non-opposing directives** coexist with leans normally (different areas, or further narrowing).
- **Observe logging:** every lean-vs-directive opposition event is logged from day one. If observe data shows real conflict volume or the pairs map proves too coarse, the `leanEffectType` taxonomy (preference / narrowing / tempo_bias / risk_bias / research_bias) is the designated Phase 2 hardening.
- **Vs equipped rules:** hard user rules (rung 3) outrank leans; soft rules (rung 8) are outranked. Post-WS1, rules contradicting the *archetype* are already warned/blocked, removing the worst structural cases.

### 7.5 Gating

Requires `ARCHETYPE_INTEGRITY_MODE = 'enforce'` (directive persistence is enforce-only; the lean block piggybacks the same read machinery). Sequence: complete the planned observe → enforce walk → open the Tier 2 fence cycle. If the enforce walk surfaces gate problems, Tier 2 waits; Tier 1 is unaffected.

### 7.6 Combination-safety test matrix (V1.1 addition)

The allowlist proves **single-entry** safety; it does not prove that leans + rules + directive + watchlist compose safely. The Tier 2 build spec includes a fixture matrix exercising the worst archetype pairings — minimum set:

1. Trend Follower + (grandfathered) mean-reversion soft rule + weakening watchlist name → surfaces, refuses to buy, no lean drift
2. Capital Preserver + most-aggressive-available lean + tempo dial at Aggressive → ordering invariant holds; no rung-2 bound crossed
3. Speculator + fundamental-quality hard rule (rung 3) → hard rule tightens; core "fundamentals irrelevant to *picks*" identity narration stays coherent
4. Diversifier + concentration-pressure directive + sector-heavy watchlist → 35% hard cap holds; opposition/override flow fires where applicable
5. Contrarian + breakout-flavored lean + trend-chasing chat directive → opposition pair fires; explicit override flow; core refusal intact on true core attacks

Each case asserts: rung order respected, receipts truthful, voice narration consistent with the actual decision.

---

## 8. Trait disposition (unchanged from V1.0)

**Soft-retire the global picker; keep the seeder; rebuild later as archetype-scoped kits.**

1. Stop surfacing the global trait equip UI (flags off / removed from live navigation; orphaned `ForgeScreen`/`ForgeLanding` subtree → refactor backlog). No fenced edits; `useTraits`/projection plumbing untouched.
2. `seedDefaultTraits` + `ARCHETYPE_DEFAULT_TRAITS` reframed in docs as the **archetype default kit** (no code rename in V1) and covered by the seeded-rule invariant (§4.5).
3. Existing traitId-keyed docs keep working via projection (this is plumbing continuity, not the §4.3 conflict-grandfathering — conflicting *rules* are cleaned pre-launch regardless of source).
4. Future archetype-scoped kits (curated `native` rules + leans + dial presets) are a post-launch design built on WS1's compatibility map. April DNA/Traits spec formally retired as roadmap; Option A plumbing, strength-profile interaction pattern, and the slot-cap lesson carried forward.

---

## 9. Out of scope (explicit)

- Earned traits (unbuilt; kit design may revisit the concept post-launch)
- Comms/verbosity dial (Axis E — voice-layer arc)
- Risk-posture dial (deferred V1.5 pending calibration evidence — §5.5)
- Knob production tuning values (calibration workstream owns; WS2 consumes its acceptance report)
- Projection-time conflict filtering (Phase 2 of WS1; presumed fenced; gated on observe data)
- `leanEffectType` taxonomy (Phase 2 of WS4; gated on opposition observe data)
- §7 audit housekeeping (triplicated hard/soft constant, `traitEnforcement.js` drift, orphaned subtree, dead-field removal) → refactor backlog; dead fields DO-NOT-REUSE here
- Firestore field-allowlist hardening (integrity backlog Item 1) — with riders: cover `dials`, `standingLeans`, and rule-doc hardness fields when it runs

---

## 10. Sequencing (revised)

```
now ──────────► WS1 rule scoping                      [no deps; highest urgency]
                 · compatibility map (needs_review → zero)
                 · L1 write-path blocks (fence-lite approval of path list)
                 · pre-launch cleanup script (demote + badge)
                 · L2 Firestore-rules feasibility (discovery)
   └──────────► WS3 voice piece                       [small; NOT behaviorally shipped]

in parallel ──► knob calibration → acceptance report (§5.2)
in parallel ──► ARCHETYPE_INTEGRITY_MODE enforce walk

both gates ───► Tier 2 fence bundle                   [one approval, split PRs]
                 · WS4 standing leans (+ opposition pairs, versioning)
                 · WS2 tempo dial (snapshot + clamp + 'user_dial' receipts)
                 · WS3 prompt-assembly piece (behavioral ship)
                 · combination-safety fixture matrix (§7.6)

post-launch ──► archetype-scoped kits · projection filtering (fenced) ·
                leanEffectType (if data) · risk dial V1.5 · Axis E dial
```

Each workstream: own build spec, own branch (ONE TASK = ONE BRANCH). WS1's build spec is first and includes the family map + per-rule exception list as fixtures, plus the enumerated write-path list for fence-lite approval.

---

## 11. Review log — dispositions of the adversarial pass

| Review point | Disposition |
|---|---|
| Hard-promote block is decision-adjacent; needs fence-aware review + authoritative enforcement | **Accepted** (fence-lite process; enforcement stack §4.4) — *modified* for client-direct Firestore reality: server-side path may not exist; L2 feasibility is a WS1 discovery question |
| Phase 2 projection filtering presumed fenced | **Accepted** |
| Grandfathering too generous pre-launch | **Accepted** — replaced with pre-launch cleanup (§4.3) |
| Don't ship scored tempo dial on live read; UI lock insufficient | **Accepted** — WS2 mechanics moved wholly into Tier 2 bundle; Invariant S added |
| Receipt provenance is a blocker; new enum, don't reuse `'user_rule'` | **Accepted** — `'user_dial'`, blocking test (§5.4) |
| WS3 voice-only ≠ behaviorally shipped; test both assemblies | **Accepted** (§6) |
| Lean cap of 2 | **Confirmed** |
| Internal `needs_review` state; no ambiguous-defaults-to-neutral | **Accepted** (§4.2) |
| Per-rule adjudication for high-risk sets | **Accepted** (§4.2) |
| Leans should constrain conflicting chat directives; `leanEffectType` | **Modified** — explicit one-battle override + opposition pairs + observe logging now; `leanEffectType` deferred to Phase 2 pending data. Rationale: same-allowlist structure makes contradictions flavor-level, not identity-level (§7.4) |
| Tighten-only too broad for dials | **Accepted** — split into two principles (§2.1) |
| Combination safety untested | **Accepted** — fixture matrix (§7.6) |
| Adjustment versioning policy | **Accepted** (§7.2) |
| Calibration acceptance criteria | **Accepted** (§5.2) |
| One authorization, split PRs | **Accepted** (§7.3) |
| Risk dial underdesigned → V1.5 | **Accepted** (§5.5) |

**Remaining decisions for Flash (small):**

1. §5.4 enum: `'user_dial'` vs `'archetype_plus_user_dial'` — recommend letting build-spec discovery pick based on what the receipt builder can cleanly express.
2. §4.3 cleanup script scope: demote-to-soft (recommended) vs delete conflicting rules outright on your test agents.
3. Whether WS2's dial UI gets built dark (flag-off) alongside WS1 for design continuity, or waits entirely for the bundle. Recommend: wait — dark UI for mechanics that can't run invites drift.

---

## 12. Locked (V1.1)

1. Two families (orthogonal dials / native leans), two tiers — with **Invariant S**: nothing scoring-affecting ships outside the fence bundle.
2. Precedence ladder §2 governs all conflict semantics; **two principles** — tighten-only (rung 3), core-safe bounded modulation (rung 4).
3. WS1 ships first: 3-state map with internal `needs_review` (ships at zero), per-rule adjudication for high-risk sets, L1 write-path blocks under fence-lite approval, pre-launch cleanup script, seeded-rule invariant, Invariant R.
4. All fenced edits in one bundled authorization, delivered as split PRs (§7.3), after enforce walk + calibration acceptance.
5. Receipts are score-integrity artifacts: `'user_dial'` provenance is a WS2 blocker; `'user_rule'` is not reused.
6. Standing leans: cap 2, ids + versioning at rest, resolved-text stamping, opposition-pairs override flow, semantic edits mint new ids.
7. Dead fields (`tradeFrequency`, `sectorConcentrationCap`, `defaultConfig.risk`) DO-NOT-REUSE.
8. Traits: soft-retire picker, keep seeder, April spec retired as roadmap, kits post-launch.
9. No new generic sector-preference surface (Axis D). Risk dial deferred V1.5. WS3 not behaviorally shipped until the prompt piece lands.

**Next steps:** Flash sign-off on §11 remaining decisions → V1.1 final → WS1 build spec (compatibility map fixture + write-path enumeration + cleanup script + discovery questions L2/enum).
