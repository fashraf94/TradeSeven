# RECAP RESTORATION — MINI-ARC SPEC V1 (spec-lite)

**Date:** July 30, 2026 · **Author:** Claude — for CC execution · **Branch:** own branch (e.g. `claude/recap-restoration`), parallel to Phase 2 P3 (disjoint files)
**Status:** Fable single pass → CC discovery-lite (read-only, STOP) → build → PR → founder merges → deploy → **production observation gate**
**Grounding:** zero-groups diagnosis (`63eb74a7` + relay synthesis, Jul 30). Two live production defects; neither fixed by Step 0 (wiper hypothesis refuted on the record).

---

## 1. Why this exists and why now

Two of five reporters are structurally silent, and both are floor-bearing shapes: **S3** (Neta econ recap — the Tier-1 gate requires `actual !== null` from Sonar, which a search-LLM generating a forward calendar structurally never supplies → `releasedTier1` empty → early-skip forever, `generate-econ.js:192-196`) and **S5** (Doug earnings recap — EODHD lacks `actual_eps` for AMC reporters at same-evening cron time, compounded by a UTC-date window querying the wrong ET trading day, `generate-recap.js:114-125, :68`). With both dead, S2 is the only reliable strict shape, the §5 floor's ≥2-shapes clause binds structurally, and **every editorial period fails the floor indefinitely while reading exactly like the accepted-by-design quiet week** — the Phase 3 gate stalls with no alarm.

**Timing law:** both files are generation surface. Fixing them bumps `WIRE_GENERATION_VERSION` and resets `gateEpoch` — **free before the flip runway, a window-reset after it.** This arc must land and be observed producing before `WIRE_WRITES_ENABLED` flips. Co-critical-path with the exemplar PR.

## 2. Fixes

**F1 — Neta (S3): deterministic actuals source.** The recap path sources *released* events from the **EODHD economic calendar** (deterministic numeric `actual`/`estimate`/`previous`) instead of expecting Sonar to know the past. Tier-1/impact filtering preserved under the existing semantics (mapping confirmed in discovery). Sonar's role elsewhere (previews, catalyst color) untouched. **Regardless of source: log `releasedTier1.length` on every firing** — the silent zero becomes visible forever.

**F2 — Doug (S5): ET-aware next-morning window.** Each of the existing five firings computes "which reporters should have actuals by now" via **`deriveMarketDate`**: morning firings recap the **prior ET session's AMC reporters** (actuals posted overnight); later firings pick up same-day BMO. No new crons — the five existing firings are re-aimed, not multiplied. `priceMove` keeps its earnings-**day** referent (the addendum's declared-referent rule is unchanged). A firing that finds no postable actuals **skips with a log**, never errors. Bonus recorded, not load-bearing: morning recaps land where Phase 3's pre-market scan reads, softening F2-6 for free.

**Out of scope:** backfill (retention ~37d bounds recovery; forward-only), N4's reader cleanup (Phase 2's item), any prompt redesign beyond the minimal source-reference edits the swap requires, everything else found → register.

## 3. Hard constraints (each is an acceptance row)

- **C1 — Shape freeze:** S3 and S5 snapshot **key sets stay byte-identical** to the calibration addendum §1 photographs (`actual, estimate, previous, spy, qqq` / `epsActual, epsEstimate, priceMove, surprise, outcome`). Zero adapter changes, zero F-M4 tolerance changes — the strict-parse adapter already handles numeric strings. *(Fault: add/rename a snapshot field → red.)*
- **C2 — Date discipline:** all new date logic through `deriveMarketDate`; no wall-clock ET math. *(Fault: revert the window to UTC date; fixture at 00:30 UTC / 20:30 ET selects the wrong session → red.)*
- **C3 — Cron freeze:** `vercel.json` entry count unchanged.
- **C4 — Provenance intact:** both seams keep routing through `wireModelCall` (P2-48 auto-covers); no new client import, no param changes outside the frozen object.
- **C5 — Version law:** the edits sit inside `GENERATION_SURFACE` → `WIRE_GENERATION_VERSION` bump forced by the baseline lock (red-then-green observed and recorded). If discovery finds either file outside the manifest, that is a manifest gap to close in this arc.
- **C6 — Wire contract untouched:** story `type` and pinned `eventType` mappings unchanged (`econ_recap`→`econ_print` per `generate-econ.js:275,303,323`; `earnings_recap`); no contract-table edits.
- **C7 — Consensus write path preserved:** `economics[]` and `earnings.results` writes keep their shapes — with real actuals they now carry real operands (D-P2-8 upside, no schema change).

## 4. Discovery-lite (read-only, STOP before build)

1. **EODHD econ calendar:** existing usage in repo (DRB macro arrays? any util), endpoint + auth pattern, field names, importance→Tier-1 mapping. If no repo precedent, cite the API doc and propose the mapping for founder eyes at the STOP.
2. **Neta splice point:** where the Sonar call and the `:192-196` gate sit; the minimal source swap; any prompt text naming the source that must minimally change.
3. **Doug window mechanics:** current `:68` window construction, the five firing times, which become prior-session recaps; where `priceMove` is computed and that its earnings-day referent survives a next-morning run.
4. **Manifest membership** of both files (C5).
5. **A6 test seams:** confirm both endpoints are harness-testable with the existing mock patterns (EODHD stubbed, market state mutable).

## 5. Acceptance (A6 — beyond C1–C7's faults)

- **R1:** released Tier-1 fixture with numeric actuals → Neta story written; zero-released fixture → skip **with `releasedTier1.length` logged**. *(Fault: restore the Sonar-only source → the released fixture yields no story → red.)*
- **R2:** the real `econPrint` adapter parses a fixture built from EODHD-shaped operands → VERIFIED-capable. *(Compatibility proven by running the actual adapter, not by inspection.)*
- **R3:** AMC-reporter-yesterday fixture with overnight actuals → morning firing writes the recap; same-evening firing with no actuals → logged skip. *(Fault: restore the same-evening-only window → red.)*
- **R4:** full suite green; no fenced file in the diff; register additions only for out-of-scope findings.
- **R9 — production observation (runbook gate, not a test):** after merge+deploy, **S3 and S5 each observed writing ≥1 production story before `WIRE_WRITES_ENABLED` flips.** This line joins the flip runbook.

## 6. Process

Fable single adversarial pass on this document (proportionate: non-fenced, two seams, code-grounded diagnosis already verified; ChatGPT at founder discretion) → triage → CC discovery-lite → **STOP** (founder reviews the EODHD mapping + splice plan) → build with A6 → internal review (diff likely under the §2 threshold; escalate if not) → PR → **founder merges** → deploy → R9 observation. Merge-order note vs Phase 2 P3: independent branches, disjoint files; second merger rebases. The deferred exemplar groups (Neta recap/preview, Doug recap) remain **post-gate** per the standing ruling — new corpus accumulates first.

---

*RECAP_RESTORATION_MINIARC_SPEC_V1.md — July 30, 2026*
