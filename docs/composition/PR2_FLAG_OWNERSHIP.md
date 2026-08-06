# Composition PR 2 — THE FLAG-OWNERSHIP TABLE (R2-B3)

**One row per boundary this PR builds.** Dedicated event flags only — the event reuses NO broad archetype flag (`RULE_COMPAT_MODE`, `MANIFEST_WRITE_ENABLED`, `SHADOW_ASSEMBLY_ENABLED`, `EVAL_IDENTITY_BLOCK_ENABLED` are already ON and give zero dark-deploy protection; `COMPILER_ENABLED` is separately double-gated). The compiler/assembler boundary rows are **PR 3's** to finalize (R3-M3 split). Activation of every row rides the §8 epoch sequence — per-boundary states ride the epoch, not independent flips.

**Flag homes (deliberate split):** server flags live in `api/_utils/compositionConfig.js` (the `masteryConfig.js` precedent — 8 endpoint suites mock `featureFlags.js` with explicit export lists, so server flags there break their mocks); the one client flag lives in `src/config/featureFlags.js`.

| Boundary | Governing flag (home) | Default | Activation step (§8) | Byte-identical-while-dark test |
|---|---|---|---|---|
| Offer/equip API (equip-bundle; change-archetype target-check) | `COMPOSITION_ENFORCEMENT_MODE` (compositionConfig) | `'off'` | step 7 epoch (per-boundary state) | `composition.endpoints.test.js` "A23 (endpoint half)" + the untouched 27 `api/agent` suites (263 tests) |
| Whole-config save (update-agent-settings equippedTraits) | `COMPOSITION_ENFORCEMENT_MODE` (compositionConfig) | `'off'` | step 7 epoch | same suite, A27 rows + untouched legacy suites |
| Write-epoch fence — server chokepoints (11 endpoints + deploy gate) + background loops + admin CLI | `COMPOSITION_EPOCH_FENCE_ENABLED` (compositionConfig) | `false` | step 1 (close the write epoch) | `composition.acceptance.test.js` "A23: while dark the helper performs ZERO reads"; endpoint suite "zero epoch reads"; census wiring proof `compositionWriterCensus.test.js` |
| Write-epoch fence — client-SDK writers (rules layer) | `epochWriteOpen()` in `firestore.rules` — **no JS flag**; dark by construction (absent `composition/writeEpoch` doc = open) | doc absent | §8 runbook writes the doc at step 1; **rules block INERT UNTIL CONSOLE DEPLOY** (G1 precedent — founder deploys `deploy:rules`) | fail-open-on-absent asserted in `composition.endpoints.test.js` (endpoint analogue) + rules-emulator suite (see PR handback for emulator run status) |
| D2 display (greyed-with-reason; deferred hidden) | `COMPOSITION_DISPLAY_ENABLED` (featureFlags — client) | `false` | step 7 epoch; per-surface adoption (D3 precedent) | `compositionDisplay.test.js` flag-off byte-identity vs legacy `buildConflictBadge`; untouched `compatSurfaceCopy.test.js` |
| identityMigration feed projection | `COMPOSITION_MIGRATION_FEED_ENABLED` (compositionConfig) | `false` | step 8 post-flip (after activation record verified) | `composition.acceptance.test.js` A44 rows (projector returns [] while dark) |
| Migration script | no flag — `--apply --yes` founder-gated CLI; writes candidate namespace only | dry-run | §8 step 2 | `composition.acceptance.test.js` A8/A9/A12 |

**PR 3 rows (placeholder, finalized there per R3-M3):** CompiledBuild legality boundary · final assembler assertion — each gets its own dedicated flag row in PR 3's revision of this table.
