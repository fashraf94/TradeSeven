# Swap Motive Observability — Tier 1 · BUILD_RULES §2 Code Review

**Branch:** `claude/swap-motive-observability-tier1` (fresh off `origin/main` @ `2f554469`).
**Trigger:** cumulative diff is 13 files (>10) → §2 mandatory multi-lens, adversarial, independently-verified review, with an explicit `vite build`.
**Spec:** `20260813_SWAP_MOTIVE_OBSERVABILITY_TIER1_SPEC_V1.md`; Phase 0 anchor-confirm accepted; three founder rulings applied.

## Method
- Multi-lens diff trace (domain correctness, wiring/lifecycle, dark-flag guarantee, test integrity, honesty).
- Every finding independently verified against the real code with a concrete repro before disposition.
- `vite build` run (exit 0). Full default suite green (486 files / 7957 tests; 0 failures). Findings added tests that fail under the defect they name (mutation-checked).

## Findings — 4 raised, 4 CONFIRMED, 4 fixed

| # | File:line | Finding | Verdict | Disposition |
|---|---|---|---|---|
| 1 | `leagueSwapLedger.js` swapReasonLabel | Motive-first precedence mislabels a **guardrail-forced** swap with a stale model `swap_type` (`agent-evaluate.js:2086-2094` spreads the prior `haikuResult`, so `swap_type='upgrade'` survives while `exitReason='guardrail_stopLoss'`) → prints "upgrade" for a forced stop. | CONFIRMED | FIXED — reordered to **deterministic-first**: a deterministic `exitReason` outranks any declared motive. |
| 2 | `leagueSwapLedger.js` swapReasonLabel | An out-of-enum `swapMotive` shadowed a genuine deterministic `exitReason`, degrading to "agent decision" instead of the true protective label. | CONFIRMED | FIXED — same reorder; deterministic reason resolves before the motive branch. |
| 3 | `TradeHistorySection.jsx` | `swapReasonLabel` applied to **every** row (no swap filter); a non-swap record (neither symbol) got a spurious "AGENT DECISION" badge. | CONFIRMED | FIXED — gated on `isSwapTrade` (same predicate the recap ledger filters on → §9 agreement). |
| 4 | `StrategyDimensions.jsx:215` | The maxPosition honesty relabel (`enforcement: 'hard'→'soft'`) left the user-facing hint saying **"Hard cap on any one holding."** — the same lie surviving in UI copy. | CONFIRMED | FIXED — hint reworded to "Preferred ceiling … guidance the agent weighs, not an enforced limit." *(Product copy — flagged for founder wording review at smoke.)* |

## Mutation checks added
- `leagueSwapLedger.test.js` — "deterministic-first … OUTRANKS a (possibly stale) declared motive": asserts `{swapMotive:'upgrade', exitReason:'guardrail_stopLoss'} → 'stop-loss'`. Fails under the pre-fix motive-first code (which returned 'upgrade').
- `TradeHistorySection.motive.render.test.jsx` — "a non-swap row (neither symbol) gets NO reason badge": fails under the pre-fix ungated code.

## Probed and confirmed correct (not defects)
- The new `reason` ledger field does **not** leak into the live decomposition strip: `buildArenaModel.js:299` re-maps items to `{out,in,pts}` (VERIFIED).
- `maxPosition 'hard'→'soft'` is behaviorally inert: `maxPosition ∉ SUPPORTED_GUARDRAIL_SHAPES` (`compileBuild.js:61`) and `agentGuardrails.js` keys on presence, not the `enforcement` value — the relabel changes the honest label only, not enforcement.
- `exitReason` byte-unchanged across the four keyed subsystems (hurdle gate, receipt source, learning allowlist, calibration partition) — locked by `swapMotiveObservability.contract.test.js`, which fails if anyone repurposes the stamp.
- Gate-7 `buildSwapReceiptSource` locked call forms untouched (all 86 `agent-evaluate.test.js` guards green).

## Residual (pre-existing, out of scope — NOT introduced, NOT fixed per §3)
- `eslint` reports pre-existing errors in `agent-evaluate.js` (lines 54/141/164/1056/1871 — `process` global, unused vars) and `StrategyDimensions.jsx:27` (`motion` unused import). All are on lines untouched by this diff and present on `origin/main`. Filed as observations for separate tasking.
