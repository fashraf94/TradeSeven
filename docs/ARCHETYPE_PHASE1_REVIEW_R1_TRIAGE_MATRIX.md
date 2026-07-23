# Phase 1 Review Round 1 — Triage Matrix

**Date:** July 23, 2026 · **Reviewer:** ChatGPT · **Triage:** Claude (spec author) · **Disposition of V1.0:** NOT LOCK-READY confirmed → consolidated revision issued as V1.1.
**Tally:** 14 BLOCKER (14 accepted, 3 amended) · 13 MAJOR (13 accepted, 2 amended) · 2 MINOR (accepted). 0 rejected.

Finding numbering follows review order. "AMENDED" = accepted in substance, fix differs from reviewer's smallest-fix; amendment rationale given.

| # | Sev | Target | Disposition | Resolution in V1.1 |
|---|---|---|---|---|
| 1 | BLK | DR-2/§4.1/DR-5 | **ACCEPT-AMENDED** | Receipts gain `effectiveRuntimeResolution` captured at tick (calibrationBundleVersion, knob/band versions, modelId, promptSpecVersion, commit SHA). Amendment: immutable-artifact retrievability satisfied via git (commit SHA already stamped in control-epoch telemetry) + a generated per-version calibration snapshot artifact in-repo — no runtime artifact store. §6.2, §4.3. |
| 2 | MAJ | DR-2 | ACCEPT | `freezePolicyVersion` stamped at battle creation; battles keep their birth policy; update endpoints consult the battle stamp, not the global flag. DR-2 amended. |
| 3 | BLK | DR-12/§4 | ACCEPT | Compile from a `sourceRevisionVector`; lock transaction re-verifies before write, abort/retry on mismatch. Enabled by extending `settingsRev` coverage (finding 19). §4.4, DR-12. |
| 4 | MAJ | DR-6/DR-12 | ACCEPT | Manifest is create-only after battle start; repair may only append a superseding record before first evaluation; in-flight battles keep their manifest. DR-6 amended. |
| 5 | BLK | DR-3 | ACCEPT | Split `intendedMode` (authored taxonomy) from `effectiveEnforcement` (compile-derived: deterministic \| prompt_advisory). Constraint modes are *effective* only on deterministic substrate. Receipts + UI keyed to effective. §5.3. |
| 6 | MAJ | DR-3/§5.2 | **ACCEPT-AMENDED** | Hardness becomes a **derived legacy projection** of intendedMode (single authoritative field); per-rule hardness override retired at metadata authoring. Legal-combination matrix added (§5.4). Amendment: chose derivation over dual-authority matrix alone. |
| 7 | MAJ | DR-3 | **ACCEPT-AMENDED** | Reviewer's simpler option adopted: one primary mode + optional `secondaryEffects[]`. Full `enforcementClauses[]` decomposition logged as Phase 5+ evolution, not launch schema. |
| 8 | MAJ | §5.1 | ACCEPT | Fallback-legality table per effective enforcement: deterministic constraints may only `abstain`/`block`/fail-compile; `ignore_rule` legal only for advisory. §5.4. |
| 9 | BLK | DR-4 | ACCEPT | Guardrail compilation requires an exact-semantic `guardrailBinding` descriptor (type, scope, basis, unit, trigger, side, reset, timing). Non-equivalent = no compile, stays advisory. DR-4 rewritten. |
| 10 | BLK | DR-4/§3 | ACCEPT | Source separation: `deployedStrategy.guardrails` stays user-owned and is never overwritten; compiled outputs live in CompiledBuild; the effective merge exists only in CompiledBuild + manifest + battle snapshot. Unequip restores by construction. DR-4. |
| 11 | MAJ | DR-4 | ACCEPT | Compiled rules are removed from the discretionary CONSTRAINTS text and replaced by a system-enforced notice ("platform enforces X; do not tighten or reinterpret"). §5.5. |
| 12 | MAJ | DR-4/Q-2 | ACCEPT | CompiledBuild preview makes requested/rule-derived/effective/governing-source/removal-behavior mandatory; save blocks when effective ≠ requested and the conflict was not presented. Closes Open Q-2. §4.4. |
| 13 | BLK | DR-5 | ACCEPT | Settlement record moved OUT of `learningReceipts` to its own home (`battleSettlements/{battleId}`); learning collection stays outcome-blind. §6.4. |
| 14 | BLK | DR-5/Q-1 | ACCEPT | Per-evaluation **gate aggregate** (candidatesTested, counts by gate, no sampling ambiguity) + an unsampled terminal-gate record for every final non-action. Closes Open Q-1. §6.3. |
| 15 | MAJ | DR-5 | ACCEPT | `rulesInScope` → `rulesRendered`; consideration treated as unknown; citations remain a separate self-report field. §6.2. |
| 16 | MAJ | DR-5 | ACCEPT | Compat blocks removed from runtime receipts; they exist only in CompiledBuild + manifest `blockedControls`. §6.2. |
| 17 | MAJ | DR-5 | ACCEPT | Settlement write gains an idempotent retry marker + `receiptCoverage` stamp written inside the settlement transaction's battle update. §6.4. |
| 18 | MAJ | DR-5 | ACCEPT | `evidenceClass:'model_self_report'` on every attestation; class excluded from enforcement/compliance/saturation/fingerprint proof metrics. §6.2, §7. |
| 19 | BLK | §3/DR-12 | **ACCEPT-AMENDED** | Single authoritative counter = `settingsRev`, with coverage **extended to all behavior-affecting mutations** (incl. bundle content edits while equipped); `buildMeta.buildVersion` is a named pointer to a settingsRev value. Amendment: reuse the existing monotonic counter rather than mint a second. §3.2. |
| 20 | BLK | §3/F9 | ACCEPT | `bundleContentHash` computed at compile; any behavior-affecting bundle mutation invalidates dependent builds (recompile required before next deploy). Rules-level freeze of dimension fields noted as alternative pending the persist-on-launch constraint check in Phase 2 discovery. §3.2. |
| 21 | MAJ | §3/DR-8 | ACCEPT | Field census appendix added: storage home, owner, readers, writers, version trigger, freeze rule, retirement sequence per delta field (seeded from Census Maps 4/5). Appendix C. |
| 22 | MAJ | §3 | ACCEPT | Exact-parent compilation; missing identityVersion = explicit fail; rebase = new buildVersion + recorded compat re-verdict. §3.3. |
| 23 | BLK | §2 | ACCEPT | `identityHash` computed over all registry inputs; CI fails when content changes without version bump; every published identityVersion emits an immutable snapshot artifact. §2.3. |
| 24 | BLK | §2/§4 | ACCEPT | `CALIBRATION_BUNDLE_VERSION` introduced covering every live physics table (hftConfig, weights, temperatures, constraints, preset levers, tempo bands); stamped at lock AND in per-tick effectiveRuntimeResolution. §4.3. |
| 25 | MAJ | §2 | ACCEPT | Registry import boundary enforced by dependency test (api/-import-policy precedent); C1–C4 lists generated from registry; build fails on legacy-table imports outside adapters. §2.3, Phase-2/3 acceptance. |
| 26 | MIN | §2.1/DR-7 | ACCEPT | `deadFieldDispositions` moved out of the runtime schema into the migration decision artifact (Appendix D stub). |
| 27 | BLK | DR-13 | **ACCEPT-AMENDED** | Accepted: a defined prompt-precedence order, structural pre-resolution, and manifest recording of rendered tension pairs. Amended: full pre-render resolution of *all* textual contradictions is rejected as infeasible (requires semantic analysis of free text); the mechanism that makes true contradictions non-equippable is the compat map + reconciler, and the identity block renders an explicit subordination clause with the precedence order. Any compat-`tension` rule rendered alongside the identity block is recorded in the manifest. §5.5, DR-13. |
| 28 | MAJ | DR-10/DR-13 | ACCEPT | Two-stage validation: assembly shadow (structural safety, Phase 2) + **offline paired-evaluation harness** (captured contexts replayed off-cron via API) required before any behavior-affecting flip. Measures: input size, truncation, latency, citation, refusal compliance, action divergence. DR-10 amended. |
| 29 | BLK | §1 | ACCEPT | `PlatformGuardrails` and `GameModePolicy` schemas added with version stamps, mode overrides, intervention permissions, and precedence position. §1.2–1.3. |
| 30 | BLK | DR-12 | ACCEPT | `CompiledBuild` schema added: sourceRevisionVector, validation results, effective guardrails, blockedControls, compat verdicts, preview fields, compilerVersion, contentHash, freshness/invalidation. §4.4. |
| 31 | BLK | §5/DR-12 | **ACCEPT-AMENDED** | Compile activation gated on a hard **metadata completeness gate**; dev fixtures provided; no permissive production defaults. Amendment: completeness is field-tiered — `intendedMode`+`copyClass`+`receiptTag` require 143/143; `detectorSource`/`guardrailBinding`/`fallback` required only where effectiveEnforcement would be deterministic. §5.6. |
| 32 | MAJ | App. A/§11 | ACCEPT | DR dependency matrix added (Appendix B); acceptance criteria now require ruling with dependencies visible. |
| 33 | MIN | §0/§11 | ACCEPT | All counts corrected to thirteen. |

**On the reviewer's highest-risk call (DR-2 live calibration provenance):** agreed, and V1.1's answer is the finding-1/24 pair — live calibration is retained, but every decision now carries its own effective runtime resolution and a single calibration bundle version, with git-SHA retrievability. One manifest hash no longer masquerades as several behaviors; the manifest records lock-state, the receipt records execution-state, and the two are explicitly different fields.

**Round 2 scope:** V1.1 returns to ChatGPT with this matrix. Round 2 reviews only the deltas + verifies blocker closure; new blockers reset the cycle, otherwise verdict moves to LOCK-READY and the 13 DRs go to founder ruling.
