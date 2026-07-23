# Archetype Architecture — P2.1→P2.4a Phase Report + P2.4b Sign-off Request

**Program:** Phase 2 (`PHASE2_BUILD_BRIEF_V1.md`) · **Date:** 2026-07-23
**Branch:** `claude/archetype-phase-2-build-1rcrab` (pushed) · **Base:** `7b16edde` (= origin/main)
**Commits:** `1b004ce9` (P2.1) · `997a1e8d` (P2.2) · `749b5e3b` (P2.3) · `92e89115` (P2.4a)
**Authority:** Spec V1.2 (V1.1 + Amendment A) + the four P2.0 approval rulings (A-3 no-conflict; hash-input mapping with ruleHardness retained; CompiledBuild home + deliberate overwrite comment; Firestore shadow-diff home).

---

## Executive verdict

| Sub-phase | Status | Tests |
|---|---|---|
| P2.1 constants + schemas | **DONE** — 7 modules, 3 bump-discipline hash locks | 25/25 |
| P2.2 registry | **DONE** — registry + identityHash CI lock + snapshot artifact (six archetypes, 397 KB) + 80-importer ratchet | 9/9 |
| P2.3 compiler + gate | **DONE** — pure compiler, every §5.4 illegal pair + every binding mismatch tested; activation gate RED against live corpus by design | 41/41 |
| P2.4a dark integration | **DONE** — `COMPILER_ENABLED=false`; ten endpoints wired; in-tx compile rides the structural settingsRev increment | 7/7 new |
| Byte-identity (exit criterion 1) | **HOLDS** — full suite: **5,586 passed / 0 test failures**; all 143 `api/` test files green. Only failing files: 44 pre-existing `research/level-study` collection errors, **verified identical at baseline `7b16edde`** (worktree re-run) — out of scope, reported not fixed |
| Fence | **ZERO fenced files edited.** Fenced imports are read-only (`agentArchetypeConfig`, `agentRiskManager`, `archetypeScoring` exports) |
| P2.4b | **STOPPED — awaiting founder §7 sign-off** (request in §6) |

Activation-gate live numbers (the Phase 3–4 authoring worklist): 143 templates (matches the Spec's 143/143 exactly), 117 equippable in launch modes, **143 missing base metadata**, **350 of 702 compat cells missing** — `checkActivationGate()` fails, and `compileBuild.test.js` asserts that red so CI always shows the corpus state.

## §1. What landed (by commit)

**P2.1 (`1b004ce9`)** — `api/_utils/`: `canonicalHash.js` (sorted-key sha256, the one hash helper), `archetypeVersionConstants.js` (CALIBRATION_BUNDLE_VERSION, RULE_LIBRARY_VERSION, PROMPT_SPEC_VERSION, GUARDRAIL_SET_VERSION, GAME_MODE_POLICY_VERSION, ARCHETYPE_IDENTITY_VERSION, COMPILER_VERSION — all 1), `calibrationBundle.js` (§4.3 coverage: hftConfig×6 via fenced read, weights/temperatures/constraints, preset levers, tempo bands; recorded-hash lock fails on change-without-bump), `platformGuardrails.js` (§1.2 live-grounded: convictionFloor 70 @ `agentSwapExecution.js:77`, cooldown 24h @ `:311`, lockProximity 0.2 @ `agentRiskManager.js:8`, EMERGENCY_BYPASS_REASONS by reference; sectorCapPolicy records the census-flagged `'true'`), `gameModePolicy.js` (§1.3+A-2: tiered `baggerbomb_agent` + flat6 `baggerbomb_tournament` live deploy modes, training/season policy entries, per-mode content hash), `archetypeBuildSchemas.js` (validators: CompiledBuild §4.4+A-2, Manifest §4.1-amendments+P2.5 block, Envelope A-1 schema-versioned).

**P2.2 (`997a1e8d`)** — `archetypeRegistry.js` (Map-1 homes composed **by reference**; `getArchetypeDefinition`/`getRegistryCorpus`; completeness validator; §2.3 identityHash over all inputs incl. zones, allowlists, baseline rulebook), `docs/registry-snapshots/archetype-registry-identity-v1.json` (the immutable per-version artifact), the CI lock (hash vs snapshot → change-without-bump fails; vitest-hosted regen: `GENERATE_REGISTRY_SNAPSHOT=1`), `archetypeImportBoundaryBaseline.json` (the 80 current direct importers frozen; new ones fail toward the registry, removals must shrink the baseline).

**P2.3 (`749b5e3b`)** — `compileBuild.js` (pure; §4.4+A-2 output; §3.3 exact-parent; §5.3 derivation; §5.4 legality; §5.5 eight-field exact binding match + strictest-wins + R1-12 preview + no-double-render marking; blockedControls; founder-ruled bundleContentHash: ruleHardness IN while the field exists, compileConfidence/compileTransparency exempt), `compilerFixtures.js` (§5.6 complete fixture metadata), `activationGate.js` (§5.6+A-4 over the LIVE corpus; fallthrough = absence), `compileBuild.test.js` (41 tests).

**P2.4a (`92e89115`)** — `featureFlags.js` `COMPILER_ENABLED=false` (double-gate doc: flag AND green activation gate; flips are founder PRs). `compileOnSettingsChange.js`: two-call in-transaction protocol — reads after the enabled gate, per-live-mode compile, **overwrite-in-place `tx.set` to `agents/{agentId}/compiledBuilds/{gameMode}` carrying the founder-mandated deliberate-divergence comment**, previews returned; `sourceRevisionVector.settingsRev` = the endpoint's post-increment value (A-3: the compile mints the revision — no second counter). Ten endpoints wired (equip/unequip-bundle, reforge-bundle, equip/unequip-lean, set-tempo-dial, equip/unequip-watchlist, update-agent-settings, change-archetype): compile reads before first write, write beside `txUpdateAgentSettings`, additive `compilePreviews` response key under the flag only; idempotent no-ops never compile.

## §2. Implementation notes the founder should know (all spec-conservative; none change behavior)

1. **Verdict vocabulary mapping.** The live compat map spells the second class `'neutral'`; §5.2 declares the map "unchanged" while §4.4 names the verdict token `'compatible'`. The compiler maps input `neutral` → verdict `compatible` (the only consistent reading); documented at `archetypeBuildSchemas.js` COMPAT_VERDICTS.
2. **`valueParamKey`.** The Spec's eight binding descriptor fields don't name where the compiled VALUE comes from. The binding carries an explicit `valueParamKey` pointing into the rule's frozen `paramValues`; absence/unresolvable = authoring error, never guessed. Implementation-mapping field under the Spec's descriptor — Phase 3 authoring format should adopt or replace it.
3. **Binding token vocabulary.** trigger/side/resetBehavior/evaluationTiming values are engine-derived (the Spec names the fields, the engine fixes the semantics); the three supported shapes cite `agentGuardrails.js` line ranges. `maxPosition`/`profitTarget` are deliberately unsupported (engine no-op / soft note — §9 display-agreement).
4. **Equip-time compiles BOTH live deploy modes** (`baggerbomb_agent` + `baggerbomb_tournament`) as A-2 siblings per save — the complete live deploy surface, so P2.4b's validate-or-recompile rarely recompiles for mode. Trim to one if you prefer at the P2.4b sign-off; one-line change.
5. **V1.0 absence.** The manifest validator enforces exactly the V1.1/V1.2/P2.5-brief-specified components (frozen layers, valuesAtLock, versionStamps, freezePolicyVersion, renderedTensionPairs, manifestHash, R1-10 three-part guardrails); the V1.0 §4.1 baseline document is not in-repo — noted, nothing invented.
6. **Snapshot regen is vitest-hosted** (`GENERATE_REGISTRY_SNAPSHOT=1 npx vitest run api/_utils/archetypeRegistry.test.js`): `archetypeCharacter.js` uses extensionless relative imports that plain `node` cannot resolve — a standalone generator script would crash. Documented in the test header.
7. **`ARCHETYPE_POSTURE` excluded from the registry** (unexported internal of `openerTemplateFloor.js`, display-only); covering it would need an export-only edit for zero Phase-2 benefit — Phase 3 call.
8. **Seven existing endpoint suites' enumerated featureFlags mocks** gained `COMPILER_ENABLED: false` — partial-mock maintenance (any new flag import breaks an enumerated mock); zero assertions changed.
9. **One real dark-path bug caught and fixed during P2.4a:** the first wiring evaluated `agentRef.collection('bundles')` eagerly in the helper's argument list, which 500'd endpoint suites whose fakes lack `.collection` — exactly the byte-identity break the flag exists to prevent. Fixed by deriving the collection only after the enabled gate; `compileOnSettingsChange.test.js` now locks it with a no-`.collection` fake.
10. **Pre-existing failures (separate tasking, not fixed):** the 44 `research/level-study/tests/*` files fail at collection ("no tests") — identical at baseline `7b16edde` (worktree-verified). Out of census scope.

## §3. Exit-criteria scoreboard (Phase 2 overall)

| Criterion | Status |
|---|---|
| 1. Flags false → byte-identical | **GREEN** (5,586 passed / 0 failures; darkness locks in place) |
| 2. Compiler fixture suite + gate correctly failing | **GREEN** (41 tests; gate red = 143 metadata / 350 cells missing) |
| 3. Registry hash/CI/import-boundary + snapshot | **GREEN** (six archetypes in `archetype-registry-identity-v1.json`) |
| 4. Flags-on preview writes | **P2.4a half ready** (CompiledBuild at equip); manifest/shadow/settlement halves are P2.5–P2.6 |
| 5. /code-review + founder merge | Pending — runs before the PR at phase end (already >10 files) |

## §4. Standing prerequisites (unchanged, per your approval)

Deploy verification (firestore rules/indexes) + BUILD_RULES §1 fence-list reconciliation (`tournamentUserScoring.js`, `archetypeScoring.js`) remain prerequisites **before the P2.4b/P2.5 fence sign-offs** — flagging that they are now due.

## §5. What P2.4b will contain (the commit you'd be signing)

Fence contact: `api/agent/decide.js` only (BUILD_RULES §1). Behind `COMPILER_ENABLED` (same flag), at the P2.0-verified insertion points:

- **Tiered path** (before `createAgentBattle` at `decide.js:688-697`, around pointer write `:700`) and **tournament path** (`:1146-1162`, `:1164`): validate-or-recompile — read `agents/{id}/compiledBuilds/{gameMode}`, verify `sourceRevisionVector` against live state (settingsRev, bundle hashes, identityHash, calibration/guardrail versions, mode triple per A-2); stale/absent/invalid → recompile server-side (minting a revision per A-3) or refuse the deploy; lock-time re-verify with abort/retry per §4.4.
- Flag false → both paths byte-identical (the P2.4a darkness pattern: no reads, no writes, no response change).
- No `createAgentBattle`/doc-shape change in P2.4b (that is P2.5's separate sign-off).

**STOP.** Requesting: (a) §7 sign-off to write the P2.4b commit as specified above, (b) confirmation of the two standing prerequisites, (c) any trim on note §2.4 (dual-mode equip compiles). P2.5 (manifest at lock) will be a second, separate sign-off request on its specific commit.
