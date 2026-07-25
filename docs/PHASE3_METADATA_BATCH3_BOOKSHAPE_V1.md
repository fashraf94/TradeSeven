# Phase 3 Metadata — Batch 3: ALLOCATION + TIER_STRATEGY + REBALANCING (26 templates) — V1.1

**Date:** July 24, 2026 · **Authority:** Spec V1.3 · Guide V1.2 + ratified Sheet C (C-1…C-7) · corpus export @ HEAD `a3a9ab6` · Batch 1/2 conventions + registry
**Status:** **ACCEPTED — IN THE GATE COUNT (53/143), Jul 24.** Two rounds. C-8 `initial_allocation_policy` ratified and stamped. Gate effect on acceptance: metadata **53/143**; **first heavily gate-relevant batch** — 21 of 26 rules are clash/both mode.
**Batch-wide conventions applied:** C-7 present-truth everywhere · **Finding-8 standing rule — RATIFIED at R1: descriptors only by copying the eight verbatim shape tokens + `valueParamKey`; divergences in explicit notes; never synthesized from intent** — the only `guardrailBindingCandidate` below copies the verbatim `SUPPORTED_GUARDRAIL_SHAPES` tokens · zero `secondaryEffects` used (every demote+promote pair and conditional release below is one tier-reallocation or one composition mechanism; the selects/toggles are parameters — MV-5 is invited to challenge).

**Two semantic rulings this batch rests on (reviewer attention):**
- **SECTOR-percentage rules are NOT vacuous in slot modes** (unlike single-STOCK weight): under equal weighting, sector weight = slotCount/bookSize is real and expressible (the sector-cap arc's own derivation). Under tiered weighting the same pct is ambiguous — the **C-1 equal-weight scoping pattern applies**, noted per rule.
- **Season mode has genuine variable position sizing and cash** (trim/add/reserve rules are meaningful there). Batch 1's vacuity ruling on `risk-single-stock-limit` was mode-specific (flat6/tiered, `modes: both`) — the season `sr-*` weight rules do NOT inherit it. Stated explicitly to preempt a false-vacuity finding.

---

## allocation (`alc_`) — 9 both, 2 clash

**1. alloc-sector-cap** (both) — "max {pct}% for {sector}, rebalancing when dominant" (20–80, d=40; sector select incl. "any single")
`intendedMode: execution_constraint` (it trims/rebalances an existing breach, not only entry) · `copyClass: advisory` — "will enforce" is deterministic language on advisory substrate → copy worklist · `receiptTag: alc_sector_cap` · `detectorSource: llm_prompt` · `requiredSignals: [sector, held book]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none` · **`guardrailBindingCandidate`** (verbatim tokens, one declared divergence): `{type:'maxSectorWeight', scope:'portfolio', basis:'entry', unit:'pct', trigger:'sector_weight_exceeds', side:'entry_block', resetBehavior:'none', evaluationTiming:'post_decision_tick', valueParamKey:'pct'}` — divergences: the rule's mechanism is *rebalance-on-breach* (shape only blocks entry) and its `sector` select admits named-sector caps the shape cannot express; candidate only, never compiles as-is. Sector-pct semantics: slot-derived under equal weight; tiered ambiguity per C-1 pattern.

**2. alloc-sector-minimum** (both) — "always ≥{pct}% in {sector}" (10–50, d=20)
`intendedMode: eligibility_constraint` (book composition floor) · `copyClass: advisory` · `receiptTag: alc_sector_min` · `detectorSource: llm_prompt` · `requiredSignals: [sector, held book]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
Corroboration: **diversifier core_conflict (explicit)** ✓ — a forced single-sector floor is concentration-requiring; matches the rubric exactly. **Basis (R1-F3):** slot share under equal weighting; **tiered interpretation UNDEFINED** — mode-scoped per the C-1 pattern pending a weight-aware basis.

**3. alloc-tier-preference** (clash) — "Star tier by {attribute}" (high momentum / undervalued / high RS / high volume / earnings surprise) · carries `paramSwingNote`
`intendedMode: scoring_modifier` (it reorders the Star pick among valid candidates — nothing becomes ineligible) · `copyClass: advisory` · `receiptTag: alc_star_attribute` · `detectorSource: llm_prompt` · `requiredSignals` **per option (R1-F2):** high momentum→`momentumScore` (SIG-004) · high RS→RS-vs-SPY (SIG-008) · high volume→RVOL (SIG-008) · **undervalued→NO bound signal** (no valuation field exists in the SIG set) · **earnings surprise→NO bound field** · `predicateDefined: false` **scoped to the undervalued and earnings-surprise options** — until bound, those two are inert-by-honesty in any deterministic future · `missingDataFallback: ignore_rule` · `guardrailBinding: none`. *(Recorded irony: the unbound `'undervalued'` option is exactly the contrarian-friendly value driving kernel↔map flag #2 below — the adjudication must weigh a param subset that currently has no signal.)*
**⚠ Kernel↔map flag #2 (cell-time adjudication, not relitigated here):** stored compat marks contrarian **core_conflict**, but the param domain includes `'undervalued'` — a contrarian-native value. Under the guide's R1-8 full-domain rule this looks like **tension + narrowedParams** (admit the undervalued/RS subset), not core_conflict. Same class as the sx-04 guardian flag.

**4. alloc-even-spread** (both) — "distribute equally across sectors, {conviction}"
`intendedMode: eligibility_constraint` (book-shape) · `copyClass: advisory` · `receiptTag: alc_even_spread` · `detectorSource: llm_prompt` · `requiredSignals: [sector, held book]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`. (Guardian + diversifier native overrides already stored ✓.) **Basis (R1-F3):** equal slot counts under equal weighting; **tiered interpretation UNDEFINED** — C-1 pattern.

**5. a-05** (both) — barbell: {anchors} low-ATR + {rockets} high-ATR, avoid the middle (ATR bands 0.5–2.5% / 2.5–5%)
`intendedMode: eligibility_constraint` (composition by volatility class; the pcts are ATR bands, not weights — no vacuity question) · `copyClass: advisory` · `receiptTag: alc_barbell` · `detectorSource: llm_prompt` · `requiredSignals: [ATR-14 as pct of price (SIG-008)]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
Corroboration: **guardian core_conflict (explicit)** ✓ — mandated high-ATR rockets violate the volatility avoidance layer.

**6. a-06** (both) — RS-vs-SPY floor {rs_min}/22 + top-{pct}% tier restriction
`intendedMode: eligibility_constraint` (the RS floor gates; the tier clause narrows the same mechanism) · `copyClass: advisory` · `receiptTag: alc_rs_floor` · `detectorSource: llm_prompt` · `requiredSignals: [RS-vs-SPY (SIG-008, /22 scale), momentum ranks]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
Corroboration: **contrarian core_conflict (explicit)** ✓ — a name-level relative-strength requirement inverts counter-indicative momentum.

**7. a-07** (both) — ≥{defensive} high-fundamental stocks (floor {fund_min}) + ≤{growth} high-ATR
`intendedMode: eligibility_constraint` (composition bounds, one mechanism) · `copyClass: advisory` · `receiptTag: alc_defensive_core` · `detectorSource: llm_prompt` · `requiredSignals: [fundamentalScore (SIG-003), ATR-14]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
Corroboration: **degen core_conflict (explicit)** ✓ — a fundamental-score requirement on an excluded-evidence archetype.

**8. a-08** (both) — overweight sectors with FantasyTimes sentiment ≥ {sentiment}
`intendedMode: scoring_modifier` (overweight = reorder, not exclude) · `copyClass: advisory` · `receiptTag: alc_sentiment_tilt` · `detectorSource: llm_prompt` · `requiredSignals: [FantasyTimes sector sentiment]` — newsroom cadence, partial coverage; fallback load-bearing · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
**⚠ Kernel↔map flag #3:** stored compat marks contrarian **core_conflict**, but this is a **sector-level** tilt — and the founder-revised Contrarian kernel rules the inversion **name-level** ("a strong sector around a washed-out name is not disqualifying"; sector tailwind can BE the recovery leg). A bullish-sector overweight plausibly lands **tension**, not core_conflict, under the locked kernel. Cell-time adjudication; contrast tv-14 below, where the stored CC is correct because the rule chases the *leading name*.

**9. a-09** (clash) — bench: {complement} off-sector + {high_upside} high-ATR breakout candidates
`intendedMode: eligibility_constraint` (bench composition) · `copyClass: advisory` · `receiptTag: alc_bench_shape` · `detectorSource: llm_prompt` · `requiredSignals: [sector, ATR-14, bench state]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

**10. a-10** (both) — tilt toward sectors sensitive to high-impact economic events within {days}
`intendedMode: scoring_modifier` · `copyClass: advisory` · `receiptTag: alc_event_tilt` · `detectorSource: llm_prompt` · `requiredSignals: [economic calendar (high-impact events), sector sensitivity mapping]` · `predicateDefined: false` — "historically sensitive" names no bound mapping; no sector-sensitivity table exists in the SIG set · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

**11. tv-14** (both) — overweight strongest sectors by RS (max {max_pct}%), pick the leading stock, respond to rotation signals ({evals})
`intendedMode: scoring_modifier` · `copyClass: advisory` · `receiptTag: alc_sector_leader` · `detectorSource: llm_prompt` · `requiredSignals: [sector RS, RS-vs-SPY, FantasyTimes rotation signals]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`. **Basis (R1-F3):** `max_pct` caps slot share under equal weighting; **tiered interpretation UNDEFINED** — C-1 pattern.
Corroboration: **contrarian core_conflict (explicit)** ✓ — *correctly*, unlike a-08: this rule buys the **leading name** in the strongest sector, which is name-level chase.

## tier_strategy (`tir_`) — 10 clash (the live mid-battle tier mechanics; no tier-rule engine exists → all advisory)

**12. ts-01** — cap tier at {tier} when intraday ATR > {pct}% of 14-day average
`intendedMode: eligibility_constraint` (tier-slot eligibility) · `copyClass: advisory` · `receiptTag: tir_vol_tier_cap` · `detectorSource: llm_prompt` (intraday-vs-14d ATR comparison is deterministic-capable via SIG-008; no hook) · `requiredSignals: [intraday ATR, ATR-14]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
Corroboration: **degen core_conflict (explicit)** ✓ — restricting tiers on the volatility it hunts.

**13. ts-02** — Star only if technical score > {score} AND above VWAP; else demote to {tier}
`intendedMode: eligibility_constraint` · `copyClass: advisory` · **`conflictGroup: 'tier_assignment_method'`** (R1-F1 — locked Stream B S2 curation: hard mutual exclusion with tv-12, two competing tier-assignment authorities; default resolution per Concern 14: preserve the archetype-selected rule unless the user explicitly overrides) · `receiptTag: tir_star_confirmation` · `detectorSource: llm_prompt` · `requiredSignals: [technicalScore (SIG-004), VWAP]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

**14. ts-03** — restrict to Support when near a positive threshold with neutral RSI ({atr} ATR proximity)
`intendedMode: eligibility_constraint` · `copyClass: advisory` · `receiptTag: tir_threshold_caution` · `detectorSource: llm_prompt` · `requiredSignals: [BaggerBomb threshold state, RSI-14]` (threshold proximity is real engine state) · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

**15. ts-04** — swap tier assignments when a lower-tier stock outperforms for {cycles} × {interval}min
`intendedMode: execution_constraint` (governs the tier-swap action) · `copyClass: advisory` · `receiptTag: tir_velocity_swap` · `detectorSource: llm_prompt` · `requiredSignals: [per-position P&L velocity (battle state)]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
Corroboration: **guardian core_conflict (explicit)** ✓ — velocity-driven churn is noise-reactive rotation.

**16. ts-05** — demote Star after threshold bonus + overbought RSI ({rsi}); promote strongest Core
`intendedMode: execution_constraint` (one tier-reallocation mechanism; demote+promote is a single move) · `copyClass: advisory` · `receiptTag: tir_bonus_rotation` · `detectorSource: llm_prompt` · `requiredSignals: [BaggerBomb threshold history, RSI-14]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

**17. ts-06** — demote flatlining Star (<{pct}% over {cycles} cycles); promote most active
`intendedMode: execution_constraint` · `copyClass: advisory` · `receiptTag: tir_flatline_rotation` · `detectorSource: llm_prompt` · `requiredSignals: [per-position movement (battle state)]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`. (Guardian explicit **neutral override** already stored — consistent with the CP kernel since tier demotion isn't a position exit; noted, no flag.)

**18. ts-07** — demote toward negative thresholds ({atr} ATR); re-promotion requires {recovery} ATR recovery
`intendedMode: execution_constraint` (demote + its reversal condition = one mechanism with hysteresis; no secondaryEffects) · `copyClass: advisory` · `receiptTag: tir_bleed_protection` · `detectorSource: llm_prompt` · `requiredSignals: [BaggerBomb threshold state, ATR-14]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`. (Guardian native override stored ✓ — halving multiplied bleed is protective.)

**19. ts-08** — demote Star to {tier} on bearish price/MACD-histogram divergence
`intendedMode: execution_constraint` · `copyClass: advisory` · `receiptTag: tir_divergence_demote` · `detectorSource: llm_prompt` · `requiredSignals: [MACD histogram, price (SIG-008; RSI-divergence exists as a computed pattern — MACD divergence is model-read)]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

**20. ts-09** — restrict max tier to {tier} for first {minutes}min of EARLY phase, then promote top performer
`intendedMode: execution_constraint` **(R1-F4 — recomposed: the post-window promotion is an affirmative tier-reallocation requiring a performance comparison and an execution event, not merely the window expiring)** · `secondaryEffects: [scope_narrowing]` (the early-phase tier cap) · `copyClass: advisory` · `receiptTag: tir_early_restraint` · `detectorSource: llm_prompt` · `requiredSignals: [battle phase + clock (game state), per-position performance]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

**21. tv-12** — tiers by factor count passed: tech>{tech}, RSI in [{rsi_low},{rsi_high}], volume>{vol}x
`intendedMode: scoring_modifier` (a ranking rubric for tier assignment — nothing is excluded) · `copyClass: advisory` · **`conflictGroup: 'tier_assignment_method'`** (R1-F1 — pairs with ts-02, hard mutual exclusion; same resolution default) · `receiptTag: tir_factor_ladder` · `detectorSource: llm_prompt` · `requiredSignals: [technicalScore, RSI-14, RVOL]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

## rebalancing (`reb_`) — 5 season (season has real position weights + cash; no vacuity)

**22. sr-01** — trim positions > {maxPct}% back to {targetPct}% · *"Hard priority"*
`intendedMode: execution_constraint` · `copyClass: advisory` — **copy defect flagged**: "Hard priority" on a rule with no verified enforcement route; NOT bridge-mapped (the verified bridge emits only stopLoss/trailingStop/maxSectorWeight), and the engine's `maxPosition` guardrail no-ops (Finding 11) — disposition: honest-copy rewording OR a future position-trim substrate; until either, no surface presents it as enforced · `receiptTag: reb_position_trim` · `detectorSource: llm_prompt` · `requiredSignals: [position weights (season-real)]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none` (maxPosition-shaped; unsupported by design).

**23. sr-02** — entry scan when cash > {pct}%; also sets Day-1 reserve
`intendedMode: execution_constraint` (primary mechanism: the cash-threshold entry scan) · **⚠ COMPOUND FLAGGED (R1-F5):** the Day-1 reserve clause is a distinct mechanism (an initial-allocation policy at a different lifecycle point). Splitting the ruleId is a corpus change outside metadata authoring (the ratified copy-defect boundary), so `secondaryEffects: [initial_allocation_policy]` — **RATIFIED (closure round) and stamped, ministerial execution as authorized**; the Day-1 reserve clause is the value's first client · `copyClass: advisory` · `receiptTag: reb_cash_deploy` · `detectorSource: llm_prompt` · `requiredSignals: [cash balance (season-real)]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

**24. sr-03** — rebalance when sector weight drifts > {tolerance}% from initial
`intendedMode: execution_constraint` · `copyClass: advisory` · `receiptTag: reb_drift_correct` · `detectorSource: llm_prompt` · `requiredSignals: [sector weights, initial allocation snapshot]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`. (Diversifier native override stored ✓.)

**25. sr-04** — add {addPct}% to winners above {threshold}% · corpus itself notes "Conflicts with Position Size Cap"
`intendedMode: execution_constraint` · `copyClass: advisory` · `receiptTag: reb_press_winners` · `detectorSource: llm_prompt` · `requiredSignals: [position gains, weights, cash]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none` · `conflictGroup: none` (R1-F1 — the proposed `position_sizing` group is WITHDRAWN: sr-01 and sr-04 are not mutually exclusive; the cap *constrains* the add through normal rule resolution, so the corpus's "Conflicts with Position Size Cap" note is a parameter/precedence interaction recorded here, not exclusion).
Corroboration: **contrarian core_conflict (explicit)** ✓ — adding to strength is chasing.

**26. sr-05** — trim {reducePct}% from positions lagging SPY by {threshold}% over {days}d
`intendedMode: execution_constraint` · `copyClass: advisory` · `receiptTag: reb_laggard_bleed` · `detectorSource: llm_prompt` · `requiredSignals: [position returns, SPY benchmark returns (SIG-008 RS-vs-SPY adjacent)]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

---

## Batch findings

1. **Gate relevance:** 21 of 26 rules are clash/both — this batch's future compat columns are the first large tranche of the 702-cell matrix. Metadata → 53/143 on acceptance.
2. **Zero authoritative bindings; one candidate** (alloc-sector-cap, verbatim tokens, divergences declared). Finding-8 discipline held: no invented vocabulary anywhere in this batch.
3. **Two new kernel↔map disagreement flags for cell-time adjudication:** alloc-tier-preference (contrarian CC vs. the R1-8 full-domain rule — `'undervalued'` is in the param domain) and a-08 (contrarian CC vs. the founder-ruled *name-level* inversion — a sector-sentiment tilt is not a name chase). tv-14 is the control case proving the stored map gets it right when the rule genuinely chases the leading *name*. With sx-04/guardian, the adjudication list is now three.
4. **One copy defect (sr-01 "Hard priority")** — advisory substrate, maxPosition-shaped, engine no-op; honest-copy worklist.
5. **conflictGroup corrected (R1-F1):** the genuine locked pair is `tier_assignment_method` (ts-02↔tv-12, hard mutual exclusion per Stream B S2 curation + Concern-14 default); the proposed `position_sizing` group is withdrawn as a parameter/precedence interaction. Verified against `FORGE_STREAM_B_SESSION_2_CURATION.md` — the reviewer's provenance claim was correct project history.
6. **Nine explicit core_conflict corroborations, all matching the locked rubrics** (diversifier 1, guardian 2, degen 2, contrarian 4) — minus the two flagged for adjudication above, which are *disagreements*, not corroborations, and are counted separately.
7. Registry: 11 `alc_` + 10 `tir_` + 5 `reb_` appended — cumulative **53 tags, 0 collisions**.

## Appendix A — Cumulative receiptTag registry (through Batch 3)
Batches 1–2 (27): as previously listed. Batch 3 (26): `alc_sector_cap alc_sector_min alc_star_attribute alc_even_spread alc_barbell alc_rs_floor alc_defensive_core alc_sentiment_tilt alc_bench_shape alc_event_tilt alc_sector_leader tir_vol_tier_cap tir_star_confirmation tir_threshold_caution tir_velocity_swap tir_bonus_rotation tir_flatline_rotation tir_bleed_protection tir_divergence_demote tir_early_restraint tir_factor_ladder reb_position_trim reb_cash_deploy reb_drift_correct reb_press_winners reb_laggard_bleed`
**53 assigned · 0 collisions.**
