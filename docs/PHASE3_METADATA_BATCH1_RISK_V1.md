# Phase 3 Metadata — Batch 1: RISK category (12 templates) — V1.1

**Date:** July 23, 2026 · **Authority:** Spec V1.3 §5.1/§5.3/§5.4 + Amendment B-1 · Authoring Guide V1.1 §7 · corpus export @ HEAD `a3a9ab6` (143 verified)
**Status:** **ACCEPTED — IN THE GATE COUNT (12/143), Jul 23.** All conditions resolved: R1 fixes applied (V1.1); CC verification item 1 REFUTED entry 4's binding (engine stopLoss is pct-of-entry only + non-numeric param — stays advisory, mismatch recordable as bindingMismatch, ATR-unit stop logged as engine gap); item 2 REFUTED entry 6's candidate at HEAD (r-06 wired to nothing; the actually-enforced sector rule is se-07 via the dimension bridge — descriptor retained as future-arc spec, two-writers reconciliation logged for Amendment C); entry 2 DEPRECATED by ruling.
**Scope:** base metadata only (archetype-independent). Compat cells, tension treatments, and paramBounds come later, rule-major, per §8 atomicity. Existing explicit compat verdicts are noted as corroboration only.

**Batch conventions.** *(extended per review R1 — F3/F4/F5/Q1 ratifications, carried to Guide V1.2)*
- **`secondaryEffects` closed vocabulary (ratified):** `conditional_tightening` (a trigger tightens existing bounds) · `posture_shift` (advisory stance change with no mechanical effect) · `scope_narrowing` (the eligible set shrinks under a condition). Extension is by guide amendment only — never ad hoc mid-batch.
- **`predicateDefined: boolean`** (optional, default `true` when absent — ratified per F4): marks rules whose trigger condition has no bound signal or defined threshold ("elevated volatility," "major coins"). Recurring honestly-vague predicates get the field, not invented signals.
- **`receiptTag` namespace + registry (F5):** category prefixes are reserved — `rsk_` (risk) · `xst_` (exit_stops) · `alc_` (allocation) · `tec_` · `fun_` · `mid_` · `gst_` · `thr_` · `tir_` · `ins_` · `ent_` · `reb_` · `ssn_`. Appendix A of each batch carries the cumulative registry; a new tag must not appear in any prior batch's appendix.
- **Book-scope ruling (Q1):** `eligibility_constraint` legitimately covers book-state conditions — "candidate invalid when the condition fails" includes conditions over the resulting book (spread, composition). Stated here so later batches don't wobble.

**Original conventions.** `intendedMode` is assigned from what the rule does to candidate/book flow, not its tone. At HEAD the only deterministic substrates are the three guardrail shapes + the platform/knob gates, so `effectiveEnforcement` is compile-derived later; where a `guardrailBinding` is authored below it is a **CANDIDATE carrying a verification flag** — DR-4 exact-semantic matching is asserted only after the engine-side check. Advisory rules use `missingDataFallback:'ignore_rule'` (legal per §5.4); any rule that later compiles deterministic must flip to `abstain|block`. `receiptTag` is permanent — never reused.

---

## Entries

### 1. risk-sector-diversification — "Diversify across at least {n} sectors" (n: 2–6, default 3)
`intendedMode: eligibility_constraint` (book-scope: candidates invalid when the resulting book can't satisfy the spread) · `copyClass: advisory` · `receiptTag: rsk_min_sectors` · `detectorSource: llm_prompt` (sector field is deterministic-capable per stock, but no engine hook evaluates book spread at draft) · `requiredSignals: [sector]` (static) · `missingDataFallback: ignore_rule` · `guardrailBinding: none` (min-sector-count is not one of the three shapes; do not contort it into maxSectorWeight).
**Copy flag:** "rejecting portfolios that…" promises a deterministic veto the substrate cannot deliver; reword toward preference language (e.g. "steers the portfolio toward at least {n} sectors") — final copy authored in the honest-copy pass, not here (F6).

### 2. risk-single-stock-limit — "No single stock above {pct}% of portfolio" (20–60, default 40)
`intendedMode: execution_constraint` · `copyClass: advisory` · `receiptTag: rsk_single_stock_pct` · `detectorSource: none` · `requiredSignals: []` — corrected per F2: "position weights" does not exist as a signal in this game; naming a nonexistent signal violates the honesty rule, and its absence IS the vacuity finding · `missingDataFallback: ignore_rule` · `guardrailBinding: none` (maxPosition-shaped — deliberately unsupported per Spec §7) · **`status: DEPRECATED (founder-deferred ruling, Claude-ruled, Jul 23)`** — retired from the equip surface (small cleanup arc, batched later); template + metadata retained for legacy resolvability; `rsk_single_stock_pct` reserved forever.
**⚠ BATCH FINDING — STRUCTURALLY VACUOUS AT HEAD.** The game has no variable position sizing: flat6 is equal-weight (every position ≡ 16.67%, below even the 20% param floor — the rule can never bind), and tiered mode weights by scoring multiplier, not portfolio allocation. This is the maxPosition census finding recurring at the rules layer. **Recommend deprecation review** (retire, or re-scope to a slot-count semantic) rather than metadata polish; metadata above is recorded for completeness.

### 3. risk-volatility-avoidance — "Avoid stocks with volatility above {level} for their sector" (1.5x/2x/3x sector avg)
`intendedMode: eligibility_constraint` · `copyClass: advisory` · `receiptTag: rsk_vol_vs_sector` · `detectorSource: llm_prompt` — ATR/atrPercentile are real (SIG-001) but "sector-average volatility" is not a computed field; the comparison is model judgment · `requiredSignals: [ATR-14 (SIG-008), sector]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
Corroboration: stored compat already marks degen **core_conflict** (explicit) — matches SP rubric step 1.

### 4. risk-exit-atr-stop — "Exit any position that drops below {multiplier}x ATR from entry" (−1.5/−2/−2.5/−3)
`intendedMode: execution_constraint` · `copyClass: advisory` — the honest present-truth value: nothing compiles at HEAD. Flips to `deterministic` as part of the binding-verification/compile event itself, never in anticipation (F1 ruling — same discipline as the fallback flip) · `receiptTag: rsk_atr_stop` · `detectorSource: deterministic:position.entry ± multiplier×ATR14 — capable; hook pending binding verification` · `requiredSignals: [ATR-14 (SIG-008), entry price]`, per-tick freshness · `missingDataFallback: abstain if compiled; ignore_rule while advisory`.
**`guardrailBinding` (CANDIDATE — the batch's flagship):** `{type: stopLoss, scope: position, basis: entry, unit: atr, trigger: price_below_line, side: long_exit, resetBehavior: fixed_from_entry, evaluationTiming: risk_pass_per_tick, valueParamKey: 'multiplier'}`.
**Verification RESOLVED (Jul 23): REFUTED — pct-of-entry only** (`agentGuardrails.js:209-244,519-524`; compiler shape contract `compileBuild.js:59-63`). Non-exact match on unit (atr≠pct) AND the select param is non-numeric (`binding_value_unresolved`). NO compile — stays advisory per DR-4; descriptor reclassified `guardrailBindingCandidate` per Amendment C-7 (Batch 2 R1), retained as the spec for the logged **ATR-unit stop engine gap** (the trailing mechanism is already ATR-denominated, so the unit exists engine-side).

### 5. risk-avoid-declining-trend — "Avoid stocks in a sustained downtrend (below {period}-day MA)" (50/200)
`intendedMode: eligibility_constraint` · `copyClass: advisory` · `receiptTag: rsk_no_downtrend` · `detectorSource: llm_prompt` (price-vs-SMA is fully deterministic-capable — SMA50/200 are SIG-008 — but no engine hook) · `requiredSignals: [SMA-50|SMA-200 per param, price]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
Corroboration: contrarian **core_conflict** (explicit) — a no-downtrend gate excludes the Contrarian's entire hunting ground; matches its rubric exactly.

### 6. r-06 — "Limit portfolio to maximum of {max} stocks from any single sector" (1–3, default 2)
`intendedMode: eligibility_constraint` (swap/draft-in invalid when it would exceed the count) · `copyClass: advisory` — present truth; flips with compile verification (F1 ruling) · `receiptTag: rsk_sector_slot_max` · `detectorSource: deterministic:sector slot count — the checkSectorCap substrate` · `requiredSignals: [sector, held book]` · `missingDataFallback: abstain if compiled`.
**`guardrailBinding` (CANDIDATE):** `{type: maxSectorWeight, scope: portfolio_sector, basis: slot_count, unit: count→pct derived via bookSize (the sector-cap arc's exact derivation: (max/bookSize)*100 + 1e-6), trigger: swap_in_would_exceed, side: entry_block, resetBehavior: n/a, evaluationTiming: swap_time, valueParamKey: 'max'}`.
**Verification RESOLVED (Jul 23): REFUTED at HEAD** — r-06 is wired to nothing (corpus + compat map only). The genuinely mapped-and-enforced sector rule is **se-07** (season %, via the dimension bridge: `compile-dimensions.js:96` → `dimensionMapper.js:1332-1335` → `deployedStrategy.guardrails`, enforced `agent-evaluate.js:2010-2027`). Descriptor reclassified `guardrailBindingCandidate` per Amendment C-7 (Batch 2 R1), retained as future-arc spec with two standing caveats: the count→pct derivation is equal-weight-scoped (Amendment-C language), and **any future compiler claim on maxSectorWeight must reconcile with the dimension bridge as a second writer** (Amendment-C item).

### 7. r-07 — "Avoid holding more than {max} from the same sub-industry" (1–2, default 1)
`intendedMode: eligibility_constraint` · `copyClass: advisory` · `receiptTag: rsk_subindustry_max` · `detectorSource: llm_prompt` · `requiredSignals: [sub-industry taxonomy]` — **data dependency flag:** industry/sub-industry assignments are the Universe Intelligence sprint's deliverable; coverage at HEAD is partial, making `ignore_rule` fallback load-bearing, not cosmetic · `guardrailBinding: none` (no sub-industry shape).

### 8. r-08 — "Maintain ≥{anchors} large-cap and ≤{sails} small-cap" (anchors 1–4/2; sails 1–3/2)
`intendedMode: eligibility_constraint` (book composition) · `secondaryEffects: []` (two clauses, one mechanism — composition bounds; not a compound) · `copyClass: advisory` · `receiptTag: rsk_cap_structure` · `detectorSource: llm_prompt` (market-cap classes deterministic-capable via the capitalization dataset; no hook) · `requiredSignals: [market-cap class]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.

### 9. r-09 — "If portfolio drawdown exceeds {pct}%, shift to defensive mode with low-ATR only" (5–20, default 10)
`intendedMode: eligibility_constraint` (conditional: above the trigger, only low-ATR candidates are eligible) · `secondaryEffects: [posture_shift]` (vocabulary-legal per the ratified list) — genuine compound: the eligibility narrowing is primary; the "defensive mode" posture language is a secondary advisory effect · `copyClass: advisory` · `receiptTag: rsk_drawdown_defense` · `detectorSource: llm_prompt` (portfolio drawdown computable from battle state; "defensive mode" is not an engine state) · `requiredSignals: [portfolio drawdown, ATR-14]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
Authoring note for cell time: this rule's fear-response semantics will interact with SP/CP kernels differently than its neutral fallthroughs suggest — expect tension verdicts, not neutral.

### 10. r-10 — "When market volatility is elevated, restrict to ATR below {pct}% of price" (1.5–5, default 3)
`intendedMode: eligibility_constraint` (conditional) · `copyClass: advisory` · `receiptTag: rsk_calm_only_regime` · `detectorSource: llm_prompt` · `requiredSignals: [market volatility regime, ATR-14, price]` — **predicate flag:** "elevated" is undefined; no VIX-class signal exists in the SIG-008 set. Until a regime meter is bound (DRB/Index Intelligence are the candidates), the trigger is pure model judgment — `predicateDefined: false` (field ratified per F4) · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
Corroboration: degen **core_conflict** (explicit) ✓.

### 11. r-11 — "Restrict mandatory crypto to {tier}; during drawdowns, majors only" (Support/Core/Any) — CLASH-ONLY
`intendedMode: eligibility_constraint` (crypto-slot scope) · `secondaryEffects: [conditional_tightening]` (the drawdown clause) · `copyClass: advisory` · `receiptTag: rsk_crypto_tier` · `detectorSource: llm_prompt` ("major coins" has no classification field) · `requiredSignals: [crypto tier assignment, drawdown]` · `missingDataFallback: ignore_rule` · `guardrailBinding: none`.
Mode note: clash-only per its `modes` field — its six compat cells exist only under GameModePolicy modes with a crypto slot; **confirmed (Q2): the activation gate counts cells per mode-scoped equippability (Spec §5.6 + A-4)** — r-11 contributes cells only where it is equippable.

### 12. r-12 — "Avoid sectors where FantasyTimes sentiment is {sentiment} or worse" (bearish/neutral)
`intendedMode: eligibility_constraint` · `copyClass: advisory` · `receiptTag: rsk_sentiment_gate` · `detectorSource: llm_prompt` · `requiredSignals: [FantasyTimes sector sentiment]` — freshness class: newsroom cadence (daily-ish), and coverage is partial (current ticker coverage ~50 names), making `ignore_rule` fallback load-bearing · `guardrailBinding: none`.
Corroboration: contrarian **core_conflict** (explicit) ✓ — a sentiment gate excludes buying the hated, which is the archetype's edge.

---

## Batch findings (for founder + reviewer attention)

1. **One structurally vacuous rule** (risk-single-stock-limit) — the game has no position sizing; deprecation review recommended. First live catch of the metadata program paying for itself.
2. **Copy-rewording list opens with 11 of 12 entries** — every description except arguably r-11 uses deterministic verbs ("ensure/cap/automatically/enforce/restrict") on advisory substrate. This is the DR-4 honest-copy program's first concrete worklist.
3. **Two binding candidates, both verification-gated:** risk-exit-atr-stop (stopLoss, ATR-unit question) and r-06 (maxSectorWeight, count→pct derivation + possible existing se-07 mapping). One small CC read answers both; until then neither claims `copyClass: deterministic`.
4. **Three data-dependency fallbacks are load-bearing** (r-07 sub-industry, r-10 regime predicate, r-12 sentiment coverage) — these are the rules that will exercise `missingDataFallback` for real, and r-10 additionally needs a defined predicate before any deterministic future.
5. **Kernel↔stored-compat agreement:** all four explicit core_conflicts in this category (degen ×2, contrarian ×2) match the locked rubrics' predictions. Independent authorship, same verdicts.

## Reviewer instruction (ChatGPT, batch pass — guide §8)

"Batch review, not a design round: verify each of the 12 entries' `intendedMode` against what the rule does to candidate/book flow; verify no entry claims deterministic copy or a non-candidate binding; verify fallback legality per §5.4; verify the two binding descriptors are complete (all nine fields) and their verification flags sufficient; challenge the vacuity finding on risk-single-stock-limit if you disagree. Findings in the standard format; verdict: BATCH ACCEPTED (enters gate count on the CC verification items only) or the specific defect."


---

## Appendix A — Cumulative receiptTag registry (through Batch 1)

`rsk_min_sectors` · `rsk_single_stock_pct` · `rsk_vol_vs_sector` · `rsk_atr_stop` · `rsk_no_downtrend` · `rsk_sector_slot_max` · `rsk_subindustry_max` · `rsk_cap_structure` · `rsk_drawdown_defense` · `rsk_calm_only_regime` · `rsk_crypto_tier` · `rsk_sentiment_gate`

12 tags assigned · 0 collisions. Each subsequent batch appends and re-verifies uniqueness against this list.
