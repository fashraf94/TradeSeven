# Composition PR 1 (candidate registry) — BUILD_RULES §2 adversarial review

**Date:** Aug 6, 2026 · **Diff:** the candidate compat registry (new files only) on `claude/composition-candidate-registry-pr1`. **Threshold:** the registry module is ~2,000 lines, so §2 review is mandatory. · **Reviewers:** two independent adversarial lenses (cell-transcription correctness; code + integrity), each with computational verification, plus an explicit `vite build`. Findings below are the CONFIRMED/dispositioned record.

## Executive verdict

**Registry is transcription-faithful and internally airtight; production is untouched (A22).** Both lenses independently reproduced every headline number (state distribution 57/142/233/32/11, manifest hash, 11 CC-corrections / 24 relaxations, 37-cell advisory gap, per-batch tallies vs the ledgers). The cell lens found **3 rulingId defects** (no verdict/state defects — all 32 core_conflict verdicts, 42 narrowedParams bounds, and sampled advisories were faithful); the code lens found **test-guard vacuities** and one documented adapter/`deferred` gap. **All CONFIRMED defects are fixed; PR3/4-scoped items are recorded.** `vite build` ✓ (38s). Final suite: 21 green (13 registry + 8 determinism).

## Lens 1 — cell-transcription correctness (exhaustive vs the 7 ledgers)

| Check | Result |
|---|---|
| 32 core_conflict cells (verdict + displayReason + rulingIds) | verdicts + reasons **all correct**; reverse check clean (no missing/extra cc) |
| 42 non-null narrowedParams | **all bounds + params match the ledgers** |
| stratified tension advisories (all 7 batches) | **all verbatim-correct** (incl. documented copies) |
| native/neutral spot-checks | all correct |
| 11 deferred cells | exactly `f-12`×5 + `tv-10/contrarian` + `i-10`×5 |
| full state distribution | matches the 7 ledgers' own tallies exactly |
| void/rejected/withdrawn ruling ids (R-1/9/12/36/40/49/137/176/179/180/192) | **none leaked** |

**CONFIRMED defects (all FIXED):**
- **D1** `tv-10/degen` rulingIds `[R-34, R-41]` → **`[R-41]`**. R-34 is cited in the "does-not-reach" *exclusionary* sense (`CELL_BATCH_C3_FUNDAMENTAL_V1.md:10`); R-41 is the gate ruling. **Fixed.**
- **D2** `fund-market-cap/degen` rulingIds `[R-34, R-39]` → **`[R-39]`** (same R-34 exclusionary case, `C3:15`). **Fixed.**
- **D3** `i-10`×5 rulingIds `[R-230]` → **`[]`**. R-230 is "deferred and uncitable" (`C7:3`); sibling deferred families (`f-12`, `tv-10/contrarian`) correctly carry `[]`. **Fixed.**
- **D4 (cosmetic)** 8 C3 advisories retained a stray `"Guidance (advisory): "` prefix (the other 227 stripped it). **Fixed** (prefix stripped; the guidance sentences were themselves correct).

Root cause D1/D2: R-34 is an enumerated class ruling governing exactly 3 degen cells; it was over-attached where the reasoning *mentions* the class. Post-fix, `buildRulingIndex()["R-34"]` = exactly `{fund-bank-pb, fund-revenue-growth, fund-value-pe}/degen`.

## Lens 2 — code + integrity (mutation-checked)

**CONFIRMED (FIXED):**
- **C2** the test's `isDomain`/narrowedParams guard was mutation-insensitive — accepted non-numeric bounds, empty `{}`, and mis-routed param-keyed domains named `min`/`max`. **Fixed:** strict `isDomain` (numeric bounds, exact key shape) + `validNarrowed` (rejects empty; routes bare vs param-keyed). Verified it now rejects every mutation the lens produced while the real data still passes.
- **C3** the §9 anti-circularity (M9) was not delivered for the *state-distribution* claim — the only genuinely-independent number set (`ledgerBatchTallies`, hand-transcribed from the ledgers) entered the manifest hash but was **never asserted**. **Fixed:** added a test summing `ledgerBatchTallies` and asserting it equals the registry-derived distribution, so a generator miscount now fails.
- **Reproducibility** the generation pipeline was not committed. **Fixed:** `scripts/composition/` now holds the 7 transcription files + the 3 deterministic scripts + a README; regeneration is **byte-identical**.

**Dispositioned / deferred (documented, correct for a non-wired candidate):**
- **C1** `toCompilerCompatCell` passes `deferred` through, which the shipped compiler (`compileBuild.js:196-204`) would reject as `unknown_compat_state`. A `deferred` verdict is **net-new compiler vocabulary (PR 3)** per the closure sheet; the adapter test now asserts this explicitly rather than overclaiming full-contract coverage. No impact (nothing consumes the module — A22).
- **zone1Ref** the candidate schema uses `displayReason` (§1) not the legacy `zone1Ref`; the adapter emits `zone1Ref: null` and carries the reason via `tensionReason`. Schema divergence to reconcile when the compiler read-edge is built (PR 3/4).
- **"11 not 17"** independently confirmed defensible (recomputed from registry×legacy; reconciles as 45 legacy-cc = 21 kept + 24 relaxed, 32 candidate-cc = 21 kept + 11 new). Documented as a prediction-vs-authored finding, analogous to the "4→3 re-filings" Phase 0 already corrected.

**CLEAN:** A22 / zero-import (only importer is the test); adapter for native/neutral/tension/core_conflict fed through the real compiler with no errors; manifest hash / counts / diff / gap / transition matrix all independently reproduced.

## Findings referred out (not code defects — need founder input)

1. **Advisory gap (37 cells).** 35 need the uncommitted **C7 V1.0**; 2 are C2-unauthored. Tracked in the manifest; not fabricated (§3). Registry not activation-ready until supplied.
2. **§7b count.** The locked correction set of record is **11** (audit predicted 17 on the 6-archetype grid); confirm or supply the delta.

---
_Generated by [Claude Code](https://claude.ai/code)_
