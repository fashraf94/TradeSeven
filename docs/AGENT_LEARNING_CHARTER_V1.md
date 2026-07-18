# Agent Learning Charter V1 — The BaggerBomb Training Ground

**Date:** July 21, 2026
**Status:** LOCKED upon founder ratification. Governs all Learning Phase B design decisions.
**Grounding:** `ARCHETYPE_MASTERY_DISCOVERY_REPORT_V1.md` (HEAD `f9a84e50`); Agent Learning Architecture V1.3 (P1/P2 carried forward); design sessions Jul 17–21, 2026.
**Position:** This charter sits above the Phase B design document. Every Phase B schema, pipeline, and surface decision is checked against it. It does not specify implementation.

---

## §1 Purpose

This charter answers three questions permanently, so they are never re-litigated mid-build:

1. **What can the agent actually learn** from BaggerBomb, the only mode where the archetype trades 100% of the portfolio?
2. **What shape does the learning artifact take**, and how does it make a measurable difference in the user's experience?
3. **What must be true today** so the agent's accumulated mind can eventually travel outside FantasyTrades (MCP export to research/executor platforms)?

## §2 The epistemic split

BaggerBomb is a **stationary, deterministic scoring function layered on a non-stationary market.** This split partitions the learnable world:

- **The market layer is out of scope as a per-user claim type.** Claims of market alpha ("momentum works in semis") cannot reach honest statistical maturity at per-user sample sizes, decay with regime shifts, and sit adjacent to financial advice our legal framing deliberately avoids. The maturity gates will correctly starve these claims at Hunch. That is the system working. No Phase B mechanism may be designed to accelerate market-alpha claims past the gates.
- **The game layer is fully learnable because the world is closed.** Every position, swap, bench alternative, stored threshold, and intraday price is known. Therefore **every decision has a deterministically computable one-step counterfactual at settlement.** This property — unavailable to real traders — is the entire epistemic basis of the "ultimate training ground" claim.

## §3 The learning mechanism

**The center of Phase B is a deterministic, settlement-time counterfactual regret miner — not the reflection engine.** LLMs render, narrate, and propose claim assemblies over mined distributions; they never adjudicate outcomes. (P1: learning proposes; the control system disposes. The miner extends this: *arithmetic decides; language describes.*)

Rulings:

- **M1 — Episode grain.** The learning unit is the episode (threshold approach, swap decision, tier assignment, bench-alternative-left-unrotated), not the battle. A battle yields 10–30 eligible episodes. This is the answer to per-archetype evidence scarcity: archetype-scoped lessons reach Testable in a handful of battles because evidence is episode-grained.
- **M2 — One-step counterfactuals only.** "Hold vs. this swap through end of day." Never compounding, branching alternate histories.
- **M3 — Policies, never trades.** Hindsight finds a "mistake" in any single decision. A claim is only ever about the expected value of a *behavior* across all eligible episodes, with denominators attached (the V1.3 atom machinery: `opportunityDef`, `independenceKey`, partition discipline — designed for exactly this, built in Phase B).
- **M4 — Batch job, not live capture.** The miner runs post-`completeBattle` from persisted data (`trades[]`, stored thresholds, EODHD intraday). It requires nothing beyond what the Corpus Capture Patch persists.

## §4 The claim territories (ranked by realism)

**T1 — Game-craft calibration. The core. Per-user, per-archetype, launch-horizon.**
Threshold discipline (abandonment within proximity of a bonus, and its cost), tier efficiency (fraction of available multiplier value captured), swap-timing regret families (harvest-abandoned, churn, late-exit), bench utilization including **eligible-but-rejected** episodes. Every T1 claim compiles into an *existing* control — a lean, a dial position, a rule paramValue. No new runtime is invented for T1.

**T2 — Risk management. Real, and the most dangerous category.**
Naive regret mining on risk exits teaches the agent to delete its stops: protective exits "cost" points in every episode where disaster didn't arrive, and avoided disasters are invisible unless counted. **Mandate: every risk regret category carries its dual — a protection-value ledger — and risk claims are evaluated on the full outcome distribution including tails, never mean regret.** This is the one structural asymmetry the miner must be built around. A Phase B design that treats risk regret symmetrically with T1 regret is non-conformant with this charter.

**T3 — Regime-conditional claims. Real, forward-only, platform-bound.**
The clock starts at the `regimeAtStart` stamp (Corpus Capture Patch); nothing retroactive exists (Discovery A3, P1 flag). Per-user, most T3 claims live at Hunch indefinitely — acceptable. Their destination is the **platform-level archetype rebalance** (Strategy Layer V2), where cross-user aggregation supplies the sample size. Per-user they are flavor; platform-wide they are the patch notes.

**Strategies — a composition layer, never the atomic unit.**
A strategy is a named, versioned bundle of 2+ proven lessons plus an activation predicate plus invalidation, compiling to the existing bundle target. Nothing can be composed before it is mined; strategies are downstream of everything above.

## §5 The artifact — the lesson card

The user-facing artifact is a **lesson card**:

1. **Claim** — plain language, rendered from typed fields (never authored as prose).
2. **Evidence** — honest denominators ("7 of 11 eligible episodes"), partition-disciplined (P2: discovery evidence never validates).
3. **Maturity tier** — Hunch / Testable / Trial-proven, gates calibrated on false-positive rates, **never engagement**.
4. **Compiled control** — the lean/dial/paramValue it became, with provenance ("Why is this in my agent?" always answerable).
5. **Points-since-adoption** — the ledger. Because T1 lessons live in the deterministic scoring layer, their value settles in the game's own currency: "+45 across 6 battles since equipped."

**The citation loop is a requirement, not a nicety.** The agent cites the lesson at the moment it acts ("holding AMD at the threshold — Lesson 3"). Lesson → visible behavior change → citation at action time → attributed points delta. This chain is the difference between *having* a learning system and the user *watching their agent get better.*

**Ledger honesty inherits the display-agreement rule (§9).** Points-since-adoption must reconcile with the visible scoring surfaces. Agreeing on a flattering number is not compliance.

## §6 Archetype scoping and the Mastery relation

- **Native from birth.** Eligibility predicates are archetype-gated; compile targets are strictly archetype-scoped; the archive is visible across archetypes (switching is not amnesia). There is no un-scoped claim schema to migrate from — Phase B mints claims scoped.
- **Two tracks, never blended.** XP/levels are the deterministic, always-progressing track (Mastery Spec V1). Lessons are the evidence-gated, sometimes-progressing track. XP absorbs engagement pressure so the maturity gates never feel it.
- **Trials are episode generators.** A trial exists to guarantee eligible episodes for a specific lesson family (a threshold-discipline trial manufactures threshold-proximity episodes), concentrating statistical power where learning is identifiable. Trials that generate no eligible episodes for their family are miscalibrated by definition.

## §7 Portability rulings

The long-horizon target: **the agent's mind serializes over MCP** — dossier + typed control set + claim corpus + archetype identity and version lineage. The runtime (Haiku brain, trigger gate, Risk Manager, enforcement gates) never travels. Every future schema decision is checked against these rulings:

- **R1 — Dual denomination.** A claim's *behavior* fields (subject, condition, behavior, comparator) are minted in market-native vocabulary — ATR-relative, volatility-adjusted, regime-conditioned. Only the *outcome* field is denominated in game points. "Exits mean-reversion positions before 1×ATR of expected move" ports; "abandons the +15" does not. Same lesson; one is exportable.
- **R2 — Domain tag.** Every claim type carries `domain: arena | general`. Arena: threshold-harvest tactics, score-differential play — stays home. General: behavioral, risk, preference — travels. The export filter is a one-line predicate, never a migration.
- **R3 — Provenance is never laundered.** Arena-proven ≠ market-proven (no transaction costs, no slippage, bounded horizon, points objective). Export serves *behavioral profile and preferences*, never alpha claims. Provenance travels with every exported artifact, verbatim.
- **R4 — Sequenced export surface.** Research-context export (agent-as-context on a frontier LLM) precedes any executor path. The executor path is a different product with a different legal magnitude and requires counsel before it is more than a slide. Gates export as data only — external runtimes honor them voluntarily; we cannot enforce them, and no export framing may imply otherwise.

**Corollary — the moat.** The agent depreciates outside the arena: lessons decay and new claims can only be minted where the closed world makes counterfactuals computable. Export is the retention argument, not the leak.

## §8 Non-negotiables carried forward

- **P1** — Learning proposes; the existing control system disposes. Zero special authority.
- **P2** — Stories are not evidence. Discovery/confirmation partition; claims freeze before confirmation begins.
- **Gates are never engagement-tuned.** Promotion thresholds calibrate on false-positive rates only.
- **The calibration fence is untouched by learning runtime.** Lessons enter through the same gated controls a human's choice would.
- **Market-alpha claims are structurally out of scope per-user** (§2). No exceptions for exciting-looking patterns.

## §9 What Phase B builds, in order

1. **Regret taxonomy** (typed families per §4, with the T2 dual-ledger designed first, not retrofitted).
2. **The miner** (deterministic, settlement-time, episode-grained, off persisted data).
3. **Claims/atoms/maturity machinery** — designed against real mined distributions, archetype-scoped and dual-denominated from birth (R1/R2 fields present in schema v1).
4. **Lesson cards + citation loop + points-since-adoption ledger** (server-written projections; receipts/atoms remain client-read-blocked per Discovery E6).
5. **Reflection engine repositioned** — narration and claim-assembly proposal over mined distributions.

**Prerequisite:** the Corpus Capture Patch (`CORPUS_CAPTURE_PATCH_SPEC_V1.md`). The patch-merge date is recorded as the **corpus epoch v2 boundary**: receipts before it lack archetype identity and three swap classes; battles before it carry no regime stamp. Phase B analyses declare which epoch they draw from.

---

*Ratified by: ____ (Flash) — date ____*
*Amendments require a version bump and are prohibited from weakening §4-T2, §7, or §8.*
