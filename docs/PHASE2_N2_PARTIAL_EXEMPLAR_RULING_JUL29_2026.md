# PHASE 2 N2 — PARTIAL-EXEMPLAR RULING (founder, July 29, 2026)

**Status:** founder ruling of record. Amends the N2 sequencing in Spec V1.2 §4 / §7 for the exemplar set only; everything else in the locked spec set stands.
**Context:** the exemplar shortlist (`api/scripts/wire-exemplar-shortlist.js`) returned **three zero groups** — reporter × type combinations with no qualifying candidates. Diagnosis: `docs/audits/20260729_WIRE_EXEMPLAR_ZERO_GROUPS_DIAGNOSIS.md`.

## The ruling

**Embed exemplars for the four types that have candidates now; defer the three zero-group types until after the Phase 3 gate ("post-gate").** The N2.1 qualification gate still governs eligibility for the four that proceed — a shortlisted candidate is an exemplar only if it produces a clean model-generated typed-facts companion (validation → deterministic render → prose↔facts agreement). Founder taste governs selection among the qualified (N2.2).

Deferring three types is **not** a spec violation of the "exemplars before baseline capture" sequencing (§4 step 2 / D-P2-4): that ordering binds the exemplars that ship. Types with no qualifying candidate have nothing to ship; embedding them post-gate, when their production defect is fixed and real stories exist, is the correct order — not a shortcut.

## The 4 / 3 split (inference pending the founder's `considered` counts)

The diagnosis names the likely split; the founder's re-run output (the per-group `considered` count) confirms it. Recorded as inference, to be finalized against that output:

| Type | Disposition | Why |
|---|---|---|
| kai × market_pulse | **Embed now** | high-volume producer, candidates present |
| alex × market_mover | **Embed now** | event-driven producer, candidates present |
| kim × sector_column | **Embed now** | weekly ×2, candidates present |
| doug × earnings_preview | **Embed now** | the deferred batch seam produces; poll-batch TDZ does not block writes |
| **neta × econ_recap** | **Defer post-gate** | never written — Sonar-`actual` production gate (diagnosis §2/§3); live defect to fix first |
| **doug × earnings_recap** | **Defer post-gate** | `actual_eps` availability timing zeroes it (diagnosis §3); live defect to fix first |
| **neta × econ_preview** | **Defer post-gate** | sparse + retention-clipped (diagnosis §1 third-group); revisit when volume exists |

**Confirmation hook:** if the founder's `considered` counts differ from this table (e.g. `econ_preview` has candidates and a different type is the third zero), the split updates to match — the ruling ("four now, three deferred post-gate") is fixed; the exact membership follows the data.

## Consequences recorded

- The three deferred types get **no exemplars in the pre-baseline prompt bump**. Their reporter prompts ship with the four embedded plus whatever the seam already carries.
- Two of the three deferrals (`econ_recap`, `earnings_recap`) are gated on **live production defects** (diagnosis §6 separate-tasking). Post-gate embedding for those waits on those fixes landing and producing real stories — it is not merely a scheduling deferral.
- `promptVersion` (`WIRE_GENERATION_VERSION`) bumps once when the four-type exemplar set embeds (per §4 step 2), and again if/when the deferred three embed post-gate — each bump is a normal epoch reset, expected by the gate machinery.

---

*Founder ruling, recorded July 29, 2026. Governs the N2 exemplar set; the rest of the Phase 2 locked spec set is unchanged.*
