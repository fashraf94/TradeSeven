# Archetype Architecture — Phase 2 Build Brief

**Version:** 1.0 · **Date:** July 23, 2026
**Authority:** `PHASE1_MASTER_SPEC_V1_1.md` + `PHASE1_AMENDMENT_A_V1_2.md` (locked, "the Spec"). This brief adds NO design decisions — where it appears to, the Spec wins and the discrepancy is a bug in this brief.
**Executor:** Claude Code · **Mission:** implement the compiler, ResolvedAgentManifest, registry, and shadow-validation plumbing — **fully dark**. Production behavior must remain byte-identical until deliberate flag-flip PRs that are NOT part of this phase.

## 0. Standing discipline

- ONE TASK = ONE BRANCH. All Phase 2 sub-phases continue on the same branch.
- Fenced-file serialization: before P2.5 begins, confirm no other fenced-file branch is live. The two fence contacts in this phase (P2.4b, P2.5) each require explicit founder §7 sign-off on the specific commit — STOP and request it; do not proceed on inference.
- All new flags default **false** (or inert). New flags: `COMPILER_ENABLED`, `MANIFEST_WRITE_ENABLED`, `SHADOW_ASSEMBLY_ENABLED`, plus the §5.6 activation gate implemented as a failing check until Phases 3–4 author metadata.
- No new cron entries (37/40). All tick-side work rides `agent-evaluate`'s existing patterns.
- Founder prerequisites gating P2.4+ (not P2.0–P2.3): firestore rules/indexes deploy verification; BUILD_RULES §1 fence-list reconciliation.

## P2.0 — Discovery-lite (read-only, HARD STOP)

The census baselined `a26cc192`; HEAD has moved. Verify and report with file:line:
1. Attach points unchanged: `createAgentBattle` doc build + freeze block; deploy path compile insertion points in `decide.js`; equip endpoints' transaction shapes; `finalUpdate` write; `completeBattle` post-commit block.
2. Appendix C writers column: complete the delta-field census writer inventory (esp. every writer of `deployedStrategy`, `strategyPreset`, bundle dimension fields, `personality.traits`).
3. Persist-on-launch: why equipped-bundle dimension fields are writable (firestore.rules comment) and whether A-3's "legal write, unusable build" model conflicts with that use case.
4. CompiledBuild storage recommendation: default is `agents/{agentId}/compiledBuilds/{gameMode}` (server-only; note the rules addition + manual-deploy dependency). Confirm or propose alternative with rationale.
5. Durable shadow-diff home: propose (Firestore capped subcollection vs awaited GCS). Requirement per Spec DR-10: durable, awaited, never the fire-and-forget shadowLogger.
STOP → founder review of the discovery note before any code.

## P2.1 — Constants + schema modules (no behavior change)

`CALIBRATION_BUNDLE_VERSION` (covering hftConfig, ARCHETYPE_WEIGHTS/TEMPERATURES/CONSTRAINTS, preset levers, tempo bands — Spec §4.3); `RULE_LIBRARY_VERSION` (forgeKnowledgeBase); `promptSpecVersion`; `guardrailSetVersion` + PlatformGuardrails contract module (§1.2); GameModePolicy module with `gameModePolicyVersion` + content hash (§1.3, A-2); schema modules + validators for CompiledBuild (§4.4 + A-2), ResolvedAgentManifest (§4.1), behaviorRecordEnvelope (A-1). Unit tests per validator. Nothing imports these yet.

## P2.2 — Archetype registry

`archetypeRegistry` composing the existing data homes (census Map 1 inventory) behind one read surface; completeness validator; `identityHash` over all inputs with CI fail on content-change-without-version-bump (§2.3); per-version immutable snapshot artifact generation; import-boundary dependency test (api/-import-policy precedent). **No consumer migration in this phase** — the registry has zero production readers; C1–C4 generation is Phase 3.

## P2.3 — Compiler core (pure, fixture-driven)

`compileBuild({archetypeDefinition, userBuildDelta, platformGuardrails, gameModePolicy}) → CompiledBuild`: sourceRevisionVector incl. mode fields (A-2); compat verdicts with tension treatments (§5.2, fixture metadata per §5.6 — never invented defaults); intendedMode→effectiveEnforcement derivation + legal-combination + fallback-legality enforcement (§5.3–5.4); guardrailBinding exact-semantic matching + strictest-wins merge into effectiveGuardrailsPreview with mandatory preview fields (§4.4, §5.5); blockedControls. Pure functions, no I/O, exhaustive tests including every §5.4 illegal pair and every guardrailBinding mismatch case.

## P2.4 — Equip-time integration (a: non-fenced · b: FENCED)

**a.** Server compile invoked from the equip/save endpoints writing CompiledBuild to the P2.0-confirmed home; settingsRev coverage extension per A-3 (the compile mints the revision; stale/absent CompiledBuild is undeployable); preview payload returned to client. Behind `COMPILER_ENABLED=false` — when false, endpoints behave byte-identically to today.
**b. FENCE CONTACT (§7 sign-off before commit):** deploy-path invocation in `decide.js` — validate-or-recompile + lock-time sourceRevisionVector re-verify wiring (abort/retry per §4.4). Dark behind the same flag.

## P2.5 — Manifest at lock (FENCED — §7 sign-off before commit)

Manifest block written by `createAgentBattle` adjacent to `agentContext` (Spec DR-6): frozen layers, valuesAtLock, versionStamps, freezePolicyVersion (R1-2), renderedTensionPairs, manifestHash; create-only-after-start semantics (R1-4). Behind `MANIFEST_WRITE_ENABLED=false`. **Zero readers migrate in Phase 2** — `agentContext` remains the runtime authority throughout.

## P2.6 — Shadow assembly + envelope plumbing (tick-side, non-fenced module)

New non-fenced module that, per battle per tick when `SHADOW_ASSEMBLY_ENABLED`: builds the manifest-derived prompt by calling the existing exported fenced builders with manifest-derived inputs (no fenced edits); diffs against the live prompt; writes the diff to the P2.0-chosen durable home, awaited. Assembly-only — **no LLM call** (Spec DR-10). Implements the shared `behaviorRecordEnvelope` capture helper (once per battle per tick, incl. `effectiveRuntimeResolution` with commit SHA — control-epoch telemetry precedent) and stamps it on: the per-evaluation gate aggregate (§6.3, rides `finalUpdate`), the terminal-gate record, and the `battleSettlements/{battleId}` settlement record with retry marker + `receiptCoverage` stamp (§6.4, `completeBattle` post-commit attach). Per-proposal blockedActionEvent docs and fingerprint computation are **Phase 5 — out of scope**.

## P2.7 — Offline paired-evaluation harness (script, not cron)

Replays captured live contexts through candidate prompts via the API off-tick; reports input size, truncation, latency, citation, refusal compliance, action divergence (Spec DR-10 stage 2). Deliverable: script + README; no production wiring.

## Exit criteria

1. All flags false → production byte-identical (assert via existing test suites + preview smoke).
2. Compiler passes fixture suite incl. every legality/mismatch case; activation gate check exists and correctly FAILS against the current metadata-less corpus.
3. Registry hash/CI/import-boundary tests green; snapshot artifact generated for the six archetypes.
4. With flags on in preview only: CompiledBuild written at equip; manifest written at lock; shadow diffs accumulating durably; settlement records + gate aggregates written with envelopes.
5. `/code-review` at high effort before PR (mandatory — this will exceed 10 files); founder merges; flags stay false in production at merge.
STOP at P2.0 report and at each fence sign-off. No flag-flip PRs in this phase.
