# HANDOVER — Strategy Refinement for the Agent Learning Architecture

**From:** the Archetype Architecture program (this document is its formal interface hand-off) · **Date:** July 24, 2026
**Purpose of the new conversation:** refine the *strategy layer* of the Agent Learning System — claim taxonomy, evidence standards, promotion criteria, experiment design — on top of interfaces that are now ratified and locked.

---

## 1. What you're building on (existing learning-system state)

The Agent Learning System already has real foundations — this is refinement, not greenfield: Architecture V1.3 frozen; **L1 Foundation built and merged to main**; Appendix V2.1 + Manifest V5.1 locked after adversarial review; the governing principle throughout is **"learning proposes; the existing control system disposes."** Claims are typed with partitioned discovery/confirmation evidence and three-tier maturity (**Hunch → Testable → Trial-proven**), and **hard authoring is the promotion ceremony**. Known L1 findings to design around: predicate staleness ~55 min (intraday cron hourly vs. 15-min agent decisions); `volume.ratio` is a neutralized placeholder intraday (D2 structurally dead); `distanceToResistancePct` null ~59% (null `dR` abstains — adjudication pending); dual D1 classification and the `dR` null-reason discriminator exist. Primary references in project knowledge: `AGENT_LEARNING_CHARTER_V1.md`, the L1 session summaries, `FANTASYTRADES_LAYER1_FOUNDATION_REFERENCE.md`.

## 2. The ratified interface (Amendment Sheet C, item C-2 — this is new since the charter)

The archetype program formally ratified how learned content enters the platform:

- A promoted claim becomes **a rule with full §5.1 base metadata** (intendedMode, copyClass, receiptTag, detector/signal/fallback fields) and enters through the **normal admission machinery** — including a **kernel compatibility verdict** under the locked archetype rubrics. It is **never a fourth control channel** (the three channels remain: archetype definition, user build delta, platform calibration).
- Manifest provenance records `{sourceType: 'learned', sourceId: <claimId>, maturityAtPromotion}` so receipts can attribute decisions to learned content and the displacement vector can measure whether learning pulls builds away from parent identity.
- **A statistically valid but archetype-illegal claim is core_conflict for that archetype and is RETAINED as evidence about other archetypes** (white-space discovery), never deleted. Design the claim store with this cross-archetype reuse in mind.

## 3. Fixed inputs — locked, not redesign surfaces

- **Six kernel constitutions** (`CONSTITUTION_*.md`, flat in `docs/`): Trend Follower (buys moving, extended strength — band-fit .30 + volatility .25 are live ranking forces), Contrarian (name-level dislocation + bounce energy; sector strength is not disqualifying), Speculator (volatility-first, fundamentals excluded-at-zero), Fundamental Investor (two-tier quality test — soft prompt today, constitutional discipline), Diversifier (shape outranks selection; merit ranks within shape), Capital Preserver (bust-avoidance; not buy-and-hold — deterministic protective exits + slowest cadence). Each carries a 4-step compat rubric and an eval identity render. **Design against them; do not propose kernel changes** — kernel edits go through the archetype program's amendment process.
- **Verified weight vectors** (`archetypeScoring.js:14-63`): mode-invariant, all six complete. Use these, not the frozen June DEF markdown docs (known-stale narrative companions).
- **Enforcement reality** (honesty layer for any "hard rule" proposal): deterministic substrates today are exactly three guardrail shapes (`stopLoss`/`trailingStop`/`maxSectorWeight`, pct-unit) plus the season dimension bridge; everything else is prompt-advisory. Known gaps, formally logged: no deterministic admission/quality gate (C-4), no ATR-unit stop shape (C-5), the trailing shape's `basis:'hwm'` misdescribes the engine's modeled-ATR peak (contract fix pending). A learned claim proposing deterministic enforcement must map to a substrate that exists or be honest that it lands advisory.

## 4. What the refinement conversation SHOULD produce

Claim-taxonomy refinement (what counts as a claim; scoping by archetype/regime/symbol-class); evidence standards per maturity tier (sample sizes, discovery-vs-confirmation partition discipline, the N=10 wholly-contained-battles watch protocol as precedent); promotion criteria to hard authoring, including how a claim's proposed rule inherits §5.1 metadata; experiment design using the Forge strategy lab and battle telemetry; the white-space discovery loop for cross-archetype evidence; and the adjudication inputs for the pending L2 items (null-`dR` policy, asymmetric-evidence concern for blue-sky symbols).

## 5. Boundaries

Do not: redesign kernels, rubrics, or the three-channel control model; invent enforcement substrates; assume promoted rules can reach *live* builds yet (that path waits on the compat-cell matrix and compiler activation — architecture and strategy design do not). When a design wants something from the archetype side (a new metadata field, a substrate, a rubric clarification), write it as an **interface request** back to the archetype program rather than resolving it locally — that program has an amendment process for exactly this.
