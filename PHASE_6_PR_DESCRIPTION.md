# Forge Expansion Sprint v3 — PR Description

**Branch:** `claude/forge-expansion-sprint-v3` → `main`
**Design spec:** `FORGE_EXPANSION_DESIGN_SPEC_V3.md`
**Commits:** 9 sequential commits + 3 Phase 6 artifacts

## Summary

Expands the Forge rule architecture so user-selected parameters actually flow through to the backtesting evaluator (ending the "Haiku silently degraded my thesis" problem), and adds variable-duration solo sessions (1/2/3/4 weeks instead of the fixed 4-week box). Along the way: a canonical reader refactor that fixes a latent Deploy-to-Agent guardrail corruption bug (audit M2), Workshop-side duration conversation with two-stage authority enforcement, and SE-09 sector momentum filter as a new rule primitive.

## What changed (by commit)

| Commit | Phase | Summary |
|---|---|---|
| `d0a4b1b` | Phase 1 | Rewrite `dimensionsToRuleSnapshots` — 6 previously-hardcoded rules now honor user params, 4 newly-emitted rules (SE-03, SE-08, SX-06, SX-07), schema rename per spec §3.1, relocations for SR-04/SR-05. Backward-compatible reads via `readField` fallback. |
| `38f5440` | Phase 1.5 | Add SE-09 Sector Momentum Filter evaluator (top_n / specific_sectors modes). New `api/_utils/seasonCalendar.js`. Context enrichment in `seasonEvalContext.js`. Silent-pass data-freshness policy. |
| `60aad25` | Phase 2 | Rewrite Haiku compile prompt — full rule palette enumeration (schema-driven), `userSelectedDurationDays` input, `recommendedDurationDays` output, two-pass validator with conditional sub-param gating (sx-05, sx-06, se-09). |
| `9d832a6` | Phase 3 | Variable duration plumbing. Entry doc gains `mode`/`durationDays`/`durationWeeks`. Solo mode creates per-user private seasons with synthetic trading calendars. Pit-stop cron final-week guard relaxed for solo (final pit stop = end-of-session debrief). Generate-debrief aggregates full-entry logs in solo final week. |
| `2cc384d` | Phase 4 | UI updates — full 47-param schema, global "Show advanced" toggle, duration picker in Step 2 with "From Workshop" badge, atomic `macroAwareness` → `eventRisk` rename, chip picker + multi-select controls, conditional sub-param reveals. |
| `ce216c2` | Audit cleanup | M1 `posture_eventRisk` (fixes blank tone pill), S1 `benchmarkGapResponse` default `'off'` (stops silent `ss-02` emission), S2 `week` range check in generate-debrief, N1 unused var cleanup. |
| `0051f15` | Phase 4.5 | Canonical reader refactor — new `dimensionFieldAccess.js` with `FIELD_REGISTRY` + `readDimensionField` + `writeDimensionField`. Migrates all consumers. **Fixes audit M2**: `dimensionsToDirectives` / `dimensionsToGuardrails` now honor Phase 4 UI writes instead of silently deploying stale defaults. Eliminates dual-writes in `deriveDimensionsFromSnapshots`. `COLLECTION_DELTAS` migrated to canonical schema. |
| `3b3fe3b` | Phase 5 | Workshop prompt — expanded rule palette, hybrid infer-or-ask duration handling, duration-rule fit guidance, thesis schema gains `recommendedDurationDays`, few-shots demonstrate inference/ask/compile-ready patterns. |
| `20a84be` | Phase 5.5 | Gemma duration authority — `applyDurationAuthority` helper + Haiku prompt deference + `mappingNotes` override surfacing. Backstop for the user-trust contract: Workshop-recommended duration surfaces in the modal. |

## Architectural notes

### Canonical reader pattern (Phase 4.5)
Every dimension field has one source of truth via `FIELD_REGISTRY` in `src/utils/dimensionFieldAccess.js`. `readDimensionField(dv, canonicalPath)` prefers the canonical value, falls back through legacy locations on miss. `writeDimensionField` writes canonical only — no dual-writes. Consumers (UI readers, posture functions, radar scorer, emit helpers, `dimensionsToDirectives`, `dimensionsToGuardrails`) all route through this module. The pattern replaces a fragmented hand-rolled fallback chain that silently corrupted Deploy-to-Agent guardrails when the Phase 4 UI wrote canonical-only.

### Two-stage duration validation flow (Phase 5 / 5.5)
- **Gemma-side (Phase 5):** Workshop prompt instructs infer-or-ask. `normalizeThesis` validates the output (null or 5/10/15/20; off-grid coerces to null per the S1 pattern).
- **Compile-side (Phase 5.5):** Haiku's prompt instructs deference to thesis `recommendedDurationDays` when valid. `applyDurationAuthority` is the server-side backstop — overrides Haiku's output with Gemma's value and pushes a `mappingNotes` entry (only when Haiku emitted a *different valid* duration; silent when Haiku null or agreed).

Net effect: if Gemma recommends a duration during Workshop, that duration surfaces in the modal's "From Workshop" badge — regardless of what Haiku's natural inclination might be.

### Variable duration solo seasons (Phase 3)
Solo sessions create per-user private seasons (`solo-{sha256(userId|startDate|durationDays)[:12]}`) with synthetic `tradingCalendar` of the user's chosen length. Tournament entries keep the existing "join existing season" flow. Pit stops keep their weekend cadence; the "final week pit stop" guard relaxes for solo so week-N serves as the end-of-session debrief. Generate-debrief aggregates all entry logs (not just the final week) for solo final-week calls.

### Mode-scoped everything
Every rename / relocation / new rule preserves tournament-mode behavior. Every piece of legacy-schema plumbing (DIMENSION_DEFAULTS, readField fallbacks in the registry, `fomcDefensive`/`benchmarkGapResponse` emit paths) stays intact so pre-Phase-2 cached bundles continue to evaluate. Migration to canonical-only bundles is bookmarked for a future sprint (see bookmarks doc).

## User-facing changes

- **Workshop conversations know about duration.** Gemma infers 5-day for catalyst plays, 20-day for trend rotations, asks naturally when ambiguous.
- **Strategy Dimensions UI exposes 47 params across 7 dimensions** (was ~20). New rules (trend alignment, institutional sentiment, sector momentum filter, earnings exit, correlation exit) are user-configurable.
- **Global "Show advanced" toggle** keeps novice users on baseline fields (~20 controls); expert users flip to reveal the full palette.
- **Conditional sub-param reveals** — e.g., picking "Below SMA" as the technical exit trigger reveals the SMA period chip picker; picking "MACD bearish" hides it.
- **Duration picker** at top of Step 2: 1/2/3/4 week chips with "From Workshop" badge when Gemma recommended a value.
- **Solo sessions run for the chosen duration** — a 5-day solo genuinely completes in 5 trading days (was hardcoded 20).
- **End-of-session debrief** for every solo session (for short sessions this comes from the relaxed final-week pit-stop guard).

## Backward compatibility

- **Legacy DIMENSION_DEFAULTS fields kept** alongside canonical fields. `readDimensionField` falls back through them. Pre-Phase-2 cached bundles render and emit correctly.
- **Legacy tournament season** (`experiment-2026-04-13`) continues to evaluate — `populate-season-experiment.js` refactored to use the new `buildTradingCalendar` builder but produces byte-identical output.
- **Old `deriveDimensionsFromSnapshots` dual-writes removed**, but the canonical reader's legacy fallback keeps legacy consumers (any that haven't migrated) correct by transparent read-side resolution.
- **Phase 2 validator retains validation behavior** — tightened only in that it now propagates canonical-named outputs. Cached `compiledDimensionValues` docs continue to render.

## Test coverage

- **180 pre-existing tests** pass (no regressions).
- **22 new canonical-reader tests** (`src/utils/dimensionFieldAccess.test.js`) covering registry completeness, reader/writer primitives, M2 regression, backward compat.
- **10 new Phase 5.5 tests** (`api/forge/compile-dimensions.phase55.test.js`) covering `applyDurationAuthority` override logic + prompt deference smoke.
- **Total: 212 tests passing.**
- Scripted compile smoke tests across 4 synthetic theses (Phase 6.1) verify the pipeline processes the expanded schema end-to-end for catalyst plays, sector momentum themes, ambiguous durations, and earnings-exit / correlation strategies.

## Verification

| Check | Result |
|---|---|
| Static build | ✅ `vite build` clean, 24.3s |
| Full test suite | ✅ 212/212 passing |
| Syntax check on every sprint-modified `.js` file | ✅ all clean |
| FIELD_REGISTRY shape + dimension coverage | ✅ 47 canonical entries, 15 legacy fallback locations |
| Phase 4.5 migration — dead `readField`/`firstDefined` | ✅ zero live call sites (comment refs only) |
| Phase 5 → 5.5 threading — duration flows Gemma → Haiku → authority → response | ✅ wired correctly |
| Scripted compile smoke (4 synthetic theses, 27 assertions) | ✅ all pass |
| **Manual smoke tests (see `PHASE_6_MANUAL_SMOKE_TESTS.md`)** | **Required pre-merge — Flash runs** |

## Bookmarked for future sprints

See `PHASE_6_FUTURE_BOOKMARKS.md` for the consolidated list. Summary:
- **Architectural cleanup (post-canonical-reader):** `COLLECTION_DELTAS` already migrated in Phase 4.5, but one-time Firestore backfill of cached bundles (B3) and removal of legacy fields from `DIMENSION_DEFAULTS` (B4) remain.
- **Scaling preparedness:** solo-season ID 16-char expansion + collision guard (B1), orphan TTL cleanup cron (B5).
- **Product features:** end-of-tournament debrief (B6), duration-aware Haiku recompile on duration change (B7), tournament entry UI (B8).
- **Operations / monitoring:** `mappingNotes` override-rate monitoring, live Gemma smoke pass, post-deploy guardrail spot-check.

## How to merge

1. Flash runs `PHASE_6_MANUAL_SMOKE_TESTS.md` — all six tests pass.
2. Flash opens PR using this document as the body.
3. Squash-merge or merge-commit per repo convention (no preference).
4. Post-merge: run one live compile on a fresh thesis to confirm production behavior matches scripted smoke tests.
5. Create GitHub issues from `PHASE_6_FUTURE_BOOKMARKS.md` for each category so follow-up work is tracked.

---

*Forge Expansion Sprint v3 — ready for final verification and merge.*
