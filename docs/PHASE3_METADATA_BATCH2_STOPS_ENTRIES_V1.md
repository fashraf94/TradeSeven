# Phase 3 Metadata — Batch 2: EXIT_STOPS + ENTRY_CRITERIA (15 templates) — V1.2

**Date:** July 24, 2026 · **Authority:** Spec V1.3 · Guide **V1.2** (incl. Amendment C-1…C-5 conventions where ratified) · corpus export @ HEAD `a3a9ab6` · Batch 1 conventions + Appendix A registry
**Status:** **ACCEPTED — IN THE GATE COUNT (27/143), Jul 24.** Three rounds (R1 six findings → R2 one residual → R3 closed). Copy-defect boundary ratified by the reviewer: metadata flags corpus copy, never edits it; the two-outcome disposition rides verification (a). Compat-cell count unchanged (season-only batch). Gate effect on acceptance: metadata **27/143**; compat-cell gate (702) unaffected — see Finding 1.
**Conventions:** Batch 1 V1.1 conventions, plus three ratified by Amendment C-7 (R1 of this batch):
- **Present-truth applies to EVERY field** — no transition plans inside values (`missingDataFallback` holds one legal value; the R1-F1 dual-value form is banned). Planned flips live in a **Promotion note** and execute atomically with their verification event.
- **`guardrailBindingCandidate`** (C-7): descriptors authored to a rule's semantics without a verified exact shape match live in this field; `guardrailBinding` is reserved for descriptor-exact matches against a quoted supported shape. *(Retroactive: Batch 1 entries 4 and 6's retained descriptors are hereby reclassified as candidates.)*
- **Writer-status stamps** (C-7): any deterministic enforcement claim carries `enforcementProvenance`, `activeWriter`, `compilerEligibility` — machine-readable, so C-6's gate is data, not prose.

---

## Headline: all 15 rules are `modes: season`

Verified per-rule below. Consequences: (1) they advance the 143-wide metadata denominator but contribute **zero cells to the 702 activation-gate matrix** (season-only rules sit outside the equippable launch set); (2) these are the **dimension-bridge's client rules** — the season deploy path CC verified for `se-07` — so Amendment **C-6 (two-writers)** governs every binding in this batch; (3) see Finding 2 for the launch-mode consequence.

---

## Entries — exit_stops (`xst_`)

### 1. sx-01 — "Mandatory sell below {pct}% from entry" (3–20, d=8) · *"Hard priority — overrides soft holds"*
`intendedMode: execution_constraint` · `copyClass: advisory` — present truth. **Corpus display copy ("Mandatory sell… Hard priority") is a FLAGGED COPY DEFECT under C-7 while this class is advisory.** The string lives in `forgeKnowledgeBase.js` — a build change outside metadata authoring — so the artifact records the defect + disposition: verification (a) confirms bridge enforcement ⇒ copy is legitimate and the full promotion flip executes; (a) refutes ⇒ corpus rewording is a queued honest-copy build item. Until one lands, no surface may present this rule as enforced · `receiptTag: xst_stop_from_entry` · `detectorSource: llm_prompt` — present truth: no verified hook reaches this rule today (R2) · `requiredSignals: [entry price, current price]`, per-tick · `missingDataFallback: ignore_rule` — single present-truth value (R1-F1).
**Promotion note (non-field — the ONLY home for planned values, per C-7):** if verification (a) confirms bridge enforcement, flip atomically in one edit: corpus copy status → legitimate; `copyClass→deterministic`; `detectorSource→deterministic:entry-vs-current-pct` via the verified hook; `missingDataFallback→block`; writer-status stamps (`enforcementProvenance`/`activeWriter`/`compilerEligibility`).
**`guardrailBinding` — the program's first EXACT-MATCH descriptor** against the verified shape (`compileBuild.js:59-63`): `{type: stopLoss, scope: position, basis: entry, unit: pct, trigger: price_below_line, side: long_exit, resetBehavior: fixed_from_entry, evaluationTiming: risk_pass_per_tick, valueParamKey: 'pct'}`. Numeric param, pct unit, entry basis — all eight semantic fields match. Compile-eligible when the compiler activates for season mode, **subject to the C-6 per-type single-writer ruling on `stopLoss`** (the bridge may already write it — verification (a)).

### 2. sx-02 — "Trailing stop {pct}% from high-water mark" (3–25, d=10) · *"Hard priority"*
`intendedMode: execution_constraint` · `copyClass: advisory` (same (a) condition) · `receiptTag: xst_trail_from_hwm` · `detectorSource: llm_prompt` — present truth (R2); the deterministic route lives in the promotion note only · `requiredSignals: [high-water mark, current price]`, per-tick · `missingDataFallback: ignore_rule` — single present-truth value (R1-F1); same promotion-note + copy-defect discipline as sx-01 (its "Hard priority" corpus string carries the identical flagged disposition).
`guardrailBinding: none` (R1-F2 — the engine's trailing math is ATR-multiple-from-peak vs this rule's pct-from-HWM; a pct→ATR conversion would be lossy and DR-4-prohibited; no authoritative binding can exist until the supported trailingStop shape and end-to-end bridge semantics are verified AND match).
**`guardrailBindingCandidate` (C-7 — the rule's semantics, for the future ruling):** `{type: trailingStop, scope: position, basis: hwm, unit: pct, trigger: drawdown_from_peak, side: long_exit, resetBehavior: ratchets_with_peak, evaluationTiming: risk_pass_per_tick, valueParamKey: 'pct'}`. **Verification (b/c):** the engine's trailing computation uses `position.baseATR + peakMultiplier` (`agentGuardrails.js:531-545`) — an **ATR-multiple-from-peak**, while this rule is **pct-from-peak**; and the compiler's `SUPPORTED_GUARDRAIL_SHAPES.trailingStop` descriptor was never quoted (only stopLoss was). If the supported unit is atr, this is a second unit-mismatch (C-5's sibling) and the bridge — if it maps sx-02 — must be converting; the descriptor above is authored to the *rule's* semantics and does not claim a match.

### 3. sx-03 — "Exit if gain < {pct}% within {days} days" (0–5% / 2–15d) · *dead-money exit*
`intendedMode: execution_constraint` · `copyClass: advisory` · `receiptTag: xst_dead_money` · `detectorSource: llm_prompt` (entry date + gain are battle-state, deterministic-capable, no hook; time-based exits are not one of the three shapes) · `requiredSignals: [entry date, gain]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

### 4. sx-04 — "Sell at profit target {pct}%" (5–50, d=15)
`intendedMode: execution_constraint` · `copyClass: advisory` · `receiptTag: xst_profit_target` · `detectorSource: llm_prompt` (R1-F4 — the advisory reasoning path IS the detector route; `none` wrongly implied the rule reaches nothing) · `requiredSignals: [entry price, current price]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none` — **profitTarget is a deliberately unsupported shape (Spec §7)**; no coercion.
Corroboration: **degen core_conflict (explicit)** ✓ — a fixed profit ceiling contradicts riding the move; matches the SP kernel. **Cell-time flag:** the guardian column's stored explicit state must be read exactly at cell authoring — the CP rubric (R2-4c) predicts **tension** for profit-target rules, and if the stored map says native, that's the program's first kernel↔map disagreement to adjudicate. (Batch note: this batch's state summary collapsed native/neutral display; only core_conflicts are cited as corroboration.)

### 5. sx-05 — "Exit on technical breakdown: {trigger}" (rsi_overbought / macd_bearish / below_sma / either; thresholds)
`intendedMode: execution_constraint` · no `secondaryEffects` (one mechanism — exit on a selected signal; the selects are parameters, not effects) · `copyClass: advisory` · `receiptTag: xst_tech_breakdown` · `detectorSource: llm_prompt` — every trigger is SIG-008-real (RSI-14, MACD 12/26/9, SMA 20/50), deterministic-capable, no hook · `requiredSignals: [per selected trigger]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

### 6. sx-06 — "Exit {days} days before earnings; {onlyIfProfitable}" (1–5d, toggle d=true)
`intendedMode: execution_constraint` · no `secondaryEffects` (the toggle narrows scope as a *parameter*, not a second effect) · `copyClass: advisory` · `receiptTag: xst_pre_earnings_exit` · `detectorSource: llm_prompt` · `requiredSignals: [earnings calendar date, gain]` — freshness: daily calendar; **coverage-dependent → `ignore_rule` fallback is load-bearing** · `guardrailBinding: none`.

### 7. sx-07 — "Sell weaker of any pair with {days}-day correlation > {threshold}" (5/10/20d; 0.70–0.95, d=0.85)
`intendedMode: execution_constraint` · `copyClass: advisory` · `receiptTag: xst_pair_correlation` · `detectorSource: llm_prompt` · `requiredSignals: [rolling pairwise position correlations]` — **not in the SIG-008 set**; the plausible provider is Correlation Intelligence's agent-book mode (intra-book relationship metrics) — noted as a data-dependency, not asserted · `predicateDefined: false` (R1-F3 — the correlation math is defined but the ACTION predicate is not: "sell the weaker" has no comparator. Until the corpus specifies the weakness measure — return? score? unrealized P&L? — plus lookback and tie behavior, two compliant implementations could sell different positions. The comparator and its signal join `requiredSignals` when defined) · `missingDataFallback: ignore_rule` (load-bearing) · `guardrailBinding: none`.

## Entries — entry_criteria (`ent_`)

### 8. se-01 — "Block entry when RSI > {upper}" (50–80, d=65)
`intendedMode: eligibility_constraint` · `copyClass: advisory` · `receiptTag: ent_rsi_ceiling` · `detectorSource: llm_prompt` (RSI-14 SIG-008-real) · `requiredSignals: [RSI-14]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

### 9. se-02 — "Require RVOL ≥ {multiplier}x" (0.8–3, d=1.2)
`intendedMode: eligibility_constraint` · `copyClass: advisory` · `receiptTag: ent_rvol_floor` · `detectorSource: llm_prompt` (RVOL SIG-008-real) · `requiredSignals: [RVOL]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

### 10. se-03 — "Require price above {period}-day MA" (20/50/100/200, d=50)
`intendedMode: eligibility_constraint` · `copyClass: advisory` · `receiptTag: ent_above_ma` · `detectorSource: llm_prompt` (SMA set SIG-008-real) · `requiredSignals: [SMA per param, price]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
Corroboration: **contrarian core_conflict (explicit)** ✓ — the season twin of `risk-avoid-declining-trend`; excludes the archetype's hunting ground.

### 11. se-04 — "Block entry within {days} days of earnings" (1–10, d=3)
`intendedMode: eligibility_constraint` · `copyClass: advisory` · `receiptTag: ent_earnings_buffer` · `detectorSource: llm_prompt` · `requiredSignals: [earnings calendar date]` — coverage-dependent, fallback load-bearing · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

### 12. se-05 — "Require fundamentalScore ≥ {minScore}" (20–80, d=50)
`intendedMode: eligibility_constraint` · `copyClass: advisory` · `receiptTag: ent_fundamental_floor` · `detectorSource: llm_prompt` (fundamentalScore SIG-003 persisted; **no admission substrate at HEAD — C-4**; this is the season-mode cousin of the FI floor and becomes the natural first client of the C-4 arc) · `requiredSignals: [fundamentalScore]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
Corroboration: **degen core_conflict (explicit)** ✓ — excluded-type evidence; a fundamental gate is an identity attack on the Speculator.

### 13. se-06 — "Require {pct}% move over {period} days" (0.5–10% / 5/10/20d)
`intendedMode: eligibility_constraint` · `copyClass: advisory` · `receiptTag: ent_min_momentum` · `detectorSource: llm_prompt` (returns 1W+ SIG-008-real; short lookbacks map to return fields) · `requiredSignals: [return over period]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
Corroboration: **contrarian core_conflict (explicit)** ✓ — a momentum *requirement* makes the name's own momentum a positive entry signal.

### 14. se-07 — "Block entry when sector already exceeds {maxPct}%" (15–50, d=30)
`intendedMode: eligibility_constraint` · **`copyClass: deterministic` — THE PROGRAM'S FIRST, verified**: mapped through the dimension bridge (`compile-dimensions.js:96` → `dimensionMapper.js:1466-1470, 1332-1335` → `deployedStrategy.guardrails.maxSectorWeight`) and **hard-enforced live** by the cron (`agent-evaluate.js:2010-2027` → `agentGuardrails.js:272-292`). Writer status stamped machine-readable (R1-F5): `enforcementProvenance: dimension_bridge` · `activeWriter: dimension_bridge` · `compilerEligibility: blocked_pending_C6` · `receiptTag: ent_sector_weight_cap` · `detectorSource: deterministic:held-book sector weights vs maxPct` · `requiredSignals: [sector, held book]` (static/battle-state) · `missingDataFallback: abstain` (deterministic legality per §5.4).
**`guardrailBindingCandidate` (C-7 — descriptor for the future compiler path; NOT active while `compilerEligibility: blocked_pending_C6`):** `{type: maxSectorWeight, scope: portfolio_sector, basis: current_book, unit: pct, trigger: swap_in_would_exceed, side: entry_block, resetBehavior: n/a, evaluationTiming: swap_time, valueParamKey: 'maxPct'}` — authored so the C-6 ruling has both writers' semantics in front of it.

### 15. se-08 — "Require institutional ownership {direction} over {quarters} quarters" (13F)
`intendedMode: eligibility_constraint` · `copyClass: advisory` · `receiptTag: ent_institutional_trend` · `detectorSource: llm_prompt` · `requiredSignals: [13F institutional ownership trend]` — **freshness class: quarterly** (the slowest signal in the corpus; staleness is structural, not incidental) · `predicateDefined: true` (direction/quarters are well-defined given data) · `missingDataFallback: ignore_rule` (load-bearing — 13F coverage) · `guardrailBinding: none`.
Corroboration: **contrarian core_conflict (explicit)** ✓ — institutional conviction is crowd conviction; a requirement for it inverts the counter-indicative relationship.

---

## Batch findings

1. **All 15 season-only → the batch advances metadata (27/143) and zero activation-gate cells.** Their compat columns are out of the 702 denominator; cells get authored eventually for season-mode admission but never gate compiler activation.
2. **Launch-mode consequence (product flag, founder attention):** with this batch mapped, the corpus's entire stop/entry family is season-mode. The flagship clash mode's only stop rule is `risk-exit-atr-stop` — advisory, blocked by the C-5 ATR-unit gap. **At launch, clash mode has no compilable stop rule at all.** If Phase 4 wants a deterministic user stop in the flagship mode, either the C-5 engine arc ships or a pct-unit clash-mode stop template is authored. This is the strongest priority input yet for sequencing C-5.
3. **First verified `copyClass: deterministic` (se-07)** — via the dimension bridge, not the compiler. The honest-copy program's inverse case, applied: the description says "blocks entry" and it truly does.
4. **First exact-match compiler descriptor (sx-01)** against the verified stopLoss shape — retained as the batch's one authoritative `guardrailBinding` (descriptor-exact per the quoted shape contract; the open writer/provenance question governs activation via C-6, not descriptor validity — R1 reviewer concurrence).
5. **One CC verification read covers three items:** (a) are sx-01/sx-02 bridge-mapped into `deployedGuardrails` like se-07 (flips their copyClass and validates their "Hard priority" copy); (b) quote `SUPPORTED_GUARDRAIL_SHAPES` verbatim for `trailingStop` and `maxSectorWeight` (`compileBuild.js` ~:64-75); (c) the engine trailing value's unit semantics (pct vs ATR-multiple) for the sx-02 question.
6. **Five explicit core_conflict corroborations, all matching the locked rubrics** (degen: sx-04, se-05 · contrarian: se-03, se-06, se-08). One potential kernel↔map disagreement flagged for cell time: sx-04's guardian column vs the CP rubric's tension prediction.
7. Registry: 7 `xst_` + 8 `ent_` tags appended — cumulative 27, 0 collisions (Appendix A updated below).

## Appendix A — Cumulative receiptTag registry (through Batch 2)
Batch 1 (12): `rsk_min_sectors rsk_single_stock_pct rsk_vol_vs_sector rsk_atr_stop rsk_no_downtrend rsk_sector_slot_max rsk_subindustry_max rsk_cap_structure rsk_drawdown_defense rsk_calm_only_regime rsk_crypto_tier rsk_sentiment_gate`
Batch 2 (15): `xst_stop_from_entry xst_trail_from_hwm xst_dead_money xst_profit_target xst_tech_breakdown xst_pre_earnings_exit xst_pair_correlation ent_rsi_ceiling ent_rvol_floor ent_above_ma ent_earnings_buffer ent_fundamental_floor ent_min_momentum ent_sector_weight_cap ent_institutional_trend`
**27 assigned · 0 collisions.**
