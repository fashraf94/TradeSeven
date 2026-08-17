# Composition PR 2 — THE FLAG-OWNERSHIP TABLE (R2-B3)

**One row per boundary this PR builds.** Dedicated event flags only — the event reuses NO broad archetype flag (`RULE_COMPAT_MODE`, `MANIFEST_WRITE_ENABLED`, `SHADOW_ASSEMBLY_ENABLED`, `EVAL_IDENTITY_BLOCK_ENABLED` are already ON and give zero dark-deploy protection; `COMPILER_ENABLED` is separately double-gated). The compiler/assembler boundary rows are **PR 3's** to finalize (R3-M3 split). Activation of every row rides the §8 epoch sequence — per-boundary states ride the epoch, not independent flips.

**Flag homes (deliberate split):** server flags live in `api/_utils/compositionConfig.js` (the `masteryConfig.js` precedent — 8 endpoint suites mock `featureFlags.js` with explicit export lists, so server flags there break their mocks); the one client flag lives in `src/config/featureFlags.js`.

| Boundary | Governing flag (home) | Default | Activation step (§8) | Byte-identical-while-dark test |
|---|---|---|---|---|
| Offer/equip API (equip-bundle; change-archetype target-check) | `COMPOSITION_ENFORCEMENT_MODE` (compositionConfig) | `'off'` | step 7 epoch (per-boundary state) | `composition.endpoints.test.js` "A23 (endpoint half)" + the untouched 27 `api/agent` suites (263 tests) |
| Whole-config save (update-agent-settings equippedTraits) | `COMPOSITION_ENFORCEMENT_MODE` (compositionConfig) | `'off'` | step 7 epoch | same suite, A27 rows + untouched legacy suites |
| Write-epoch fence — server chokepoints (11 endpoints + deploy gate) + background loops + admin CLI | `COMPOSITION_EPOCH_FENCE_ENABLED` (compositionConfig) | **`true` — LIVE since ACTIVATION_RUNBOOK step 1.1, 2026-08-16** (shipped `false` through PR 4) | step 1.1 flip (deploy) → step 1.9 closes the write epoch | `composition.acceptance.test.js` "A23: while dark the helper performs ZERO reads"; endpoint suite "zero epoch reads"; census wiring proof `compositionWriterCensus.test.js` — **the A23 zero-read rows now describe the pre-flip posture, not the shipped one** |
| Write-epoch fence — client-SDK writers (rules layer) | `epochWriteOpen()` in `firestore.rules` — **no JS flag**; dark by construction (absent `composition/writeEpoch` doc = open) | doc absent | §8 runbook writes the doc at step 1; **rules block INERT UNTIL CONSOLE DEPLOY** (G1 precedent — founder deploys `deploy:rules`) | fail-open-on-absent asserted in `composition.endpoints.test.js` (endpoint analogue) + rules-emulator suite (see PR handback for emulator run status) |
| D2 display (greyed-with-reason; deferred hidden) | `COMPOSITION_DISPLAY_ENABLED` (featureFlags — client) | `false` | step 7 epoch; per-surface adoption (D3 precedent) | `compositionDisplay.test.js` flag-off byte-identity vs legacy `buildConflictBadge`; untouched `compatSurfaceCopy.test.js` |
| identityMigration feed projection | `COMPOSITION_MIGRATION_FEED_ENABLED` (compositionConfig) | `false` | step 8 post-flip (after activation record verified) | `composition.acceptance.test.js` A44 rows (projector returns [] while dark) |
| Migration script | no flag — `--apply --yes` founder-gated CLI; writes candidate namespace only | dry-run | §8 step 2 | `composition.acceptance.test.js` A8/A9/A12 |

**PR 3 rows (placeholder, finalized there per R3-M3):** CompiledBuild legality boundary · final assembler assertion — each gets its own dedicated flag row in PR 3's revision of this table.

**ACTIVATION step 1.1 flip — recorded 2026-08-16.** Both server flags the runbook's step 1.1 names now ship `true`:

| Flag | Was | Now | Live effect today |
|---|---|---|---|
| `COMPOSITION_EPOCH_FENCE_ENABLED` | `false` | `true` | **Yes** — the fence helpers, the B2 provisioner lease, and the `pinActivationDescriptor` seams all perform real reads. Fail-OPEN until step 1.9 writes `{state:'closed'}` (no epoch doc ⇒ open). |
| `COMPOSITION_COMPILED_IDENTITY_ENABLED` | `false` | `true` | **No live effect today — but NOT for the reason first recorded here.** The COMPILE entry points are double-gated behind `COMPILER_ENABLED` (`featureFlags.js:1105`, still `false` and DARK_BY_DESIGN) and return before reading anything. The ADVISORY RENDER seam is **not** so gated — see the correction note below. |

`COMPOSITION_MIGRATION_FEED_ENABLED` and `COMPOSITION_DISPLAY_ENABLED` are UNCHANGED and stay dark — the feed flips at the 8B unfreeze (ACTIVATION_RUNBOOK §8B), display per-surface after step 7. `COMPOSITION_ENFORCEMENT_MODE` stays `'off'`.

**CORRECTION — 2026-08-16, review finding T2.** The first version of the row above justified "no live effect" by saying every consumer of `COMPOSITION_COMPILED_IDENTITY_ENABLED` is double-gated behind `COMPILER_ENABLED`. **That justification was wrong**, and it is corrected here rather than quietly amended.

`buildCompositionAdvisoryIndex` (`api/_utils/compositionAdvisoryRender.js:45`) still defaults `enabled = COMPOSITION_COMPILED_IDENTITY_ENABLED` — the one un-converted member of the bare-flag default class that the founder's 2026-08-16 ruling converted to `false` at `compileOnSettingsChange.js:164`, `:270` and `:334`. It is called **unconditionally**, with no `COMPILER_ENABLED` gate, from two FENCED assemblers: `agentPromptAssembly.js:110` and `agentEvalPromptAssembly.js:566`.

**The conclusion still holds — the seam is inert — but by a different mechanism:** its input is always null today. `compositionCompat` is written in exactly one place, `resolvedAgentManifest.js:191`, and only when the build carries advisory keys (`compatVerdicts.some(v => 'advisory' in v)`) — i.e. only from a candidate-mode `CompiledBuild`. No `CompiledBuild` is minted at all while `COMPILER_ENABLED` is `false`, and `agent.compositionCompat` (the prompt-path argument) is never written anywhere. `buildCompositionAdvisoryIndex` returns `null` on `!compatSurface` regardless of `enabled`.

**The residual hazard, stated:** the selection is nominally the bare flag rather than the record, which is the inference runbook #11 forbids. It is gated transitively — the only source of `compositionCompat` is itself record-driven candidate mode — but not by construction. **Converting this default to `false` was deliberately NOT done in the step-1.1 branch:** both call sites are on the BUILD_RULES §1 calibration fence, so re-enabling the advisory afterwards would require a §7-gated fence edit, and darkening it would change what step 8B's probe checks can observe. That is an activation-design decision, not a flip-commit cleanup.

**FOUNDER RULING, Aug 16 2026 — leave the default UN-CONVERTED.** Converting now would buy a §7 fence gate for a seam that is provably inert, and darkening it changes what 8B's probes can observe — a worse trade during the window than after it. Recorded as a named **PRE-8B DECISION ITEM** in `docs/composition/ACTIVATION_PRECONDITIONS.md`, carrying this corrected mechanism, so it is re-read at the probe window rather than rediscovered there.
