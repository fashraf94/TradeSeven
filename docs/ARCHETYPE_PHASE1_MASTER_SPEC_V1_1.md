# Archetype Architecture — Phase 1 Master Spec

**Version:** 1.1 (CONSOLIDATED REVISION — post Review Round 1; pending Round 2 delta review + founder lock)
**Date:** July 23, 2026
**Changes from V1.0:** all 29 Round-1 findings resolved per `ARCHETYPE_PHASE1_REVIEW_R1_TRIAGE_MATRIX.md`. Material additions: PlatformGuardrails + GameModePolicy + CompiledBuild schemas; intent-vs-effective enforcement split; effectiveRuntimeResolution on receipts; CALIBRATION_BUNDLE_VERSION; identityHash; unified settingsRev build versioning; guardrailBinding semantic matching; blocked-action aggregates; settlement record relocated; DR dependency matrix.
**Inputs:** ChatGPT Architecture Doc (Jul 21) · Census Report V1 @ HEAD `a26cc192` · Review Round 1 findings (Jul 23) · Forge Rules Thesis V1.2 · Learning System Manifest V5.1
**Governing principle:** live repo authoritative; census facts F1–F9 (V1.0 §0, unchanged) remain the ground truth.

---

## 0. Scope and non-goals

Unchanged from V1.0 except: **thirteen** Decision Records (count corrected); Phase 2 runtime activation is now explicitly gated (§5.6); two new compiler-input contracts and one intermediate artifact contract are in scope (§1.2–1.3, §4.4).

---

## 1. The object model

```
ArchetypeDefinition ──┐
UserBuildDelta ───────┤
PlatformGuardrails ───┼─▶ COMPILER ─▶ CompiledBuild (preview, per save) ─▶ ResolvedAgentManifest (frozen at lock)
GameModePolicy ───────┘                                                          │
                                                              RUNTIME (tick) ────┤ reads manifest (frozen layers)
                                                                                 │ + deployed modules (live layers)
                                                                                 ▼
                                              DecisionReceipt(s) + gate aggregates + blockedActionEvents
                                                                                 ▼
                                              BattleSettlement (separate home) ─▶ BehavioralFingerprint ─▶ FormGuideSnapshot
```

**DR-1 (PROPOSED)** — unchanged: three stored shapes (Definition / Delta / Manifest), one pipeline; user-authored archetypes later reuse the Definition schema.

### 1.2 PlatformGuardrails contract (NEW — R1 finding 29)

Documents-and-versions the existing platform layer; no behavior change.

```
PlatformGuardrails {
  guardrailSetVersion            // NEW constant, bumped on any change below
  floors { bustBuffer, vwapFailure, convictionFloor(70), cooldownHours(24),
           selfSwapBan, duplicateSlotBan, lockProximity }
  universalFilters { distressedSwapInBlock }
  emergencyBypassReasonsRef      // agentRiskManager.EMERGENCY_BYPASS_REASONS (single source)
  sectorCapPolicy { mode(SECTOR_CAP_MODE tri-state), capSource }   // pending founder census ruling
  precedencePosition: 1          // ladder rung 1 — overrides every other layer, always
}
```

### 1.3 GameModePolicy contract (NEW — R1 finding 29)

```
GameModePolicy {
  gameModePolicyVersion
  mode                           // clash | flat6/tournament | training | season | (vehicle: Phase 6)
  slotStructure                  // tier slots vs flat6 — governs which guardrail types are applicable
  eligibilityFilters             // universe/theme constraints per mode
  interventionTier               // DR-2: training=gated logged directives; ranked=gated+receipted;
                                 //        vehicle=none post-lock
  ruleModeGate                   // both|clash|season admission (existing `modes` field)
  freezeExceptions[]             // mode-specific deviations from §8, each with rationale
  precedencePosition: 2          // after platform, before archetype identity
}
```

Precedence ladder (compiler-enforced, extends V1.2 §9.5): **Platform → GameMode → Archetype identity (kernel/zones) → compiled user constraints → user preferences → leans**. The renderer's existing `resolveControls` ladder is the leaf-level implementation of rungs 3–6.

---

## 2. ArchetypeDefinition contract

Schema unchanged from V1.0 §2.1 **except**: `deadFieldDispositions` removed from `physicsProfile` (relocated to Appendix D migration artifact — R1 finding 26); `physicsProfile` refs now carry `calibrationBundleVersion` (§4.3).

### 2.3 Registry integrity (NEW — R1 findings 23, 25)

- **`identityHash`**: canonical content hash computed over every registry input (all ten data homes' relevant exports + zones + allowlists + baseline rulebook). CI check: hash change without an `identityVersion` bump **fails the build**. Every published identityVersion emits an immutable snapshot artifact (generated JSON, committed — git provides retrieval).
- **Import boundary**: runtime modules may not import legacy archetype tables except through registry adapters; enforced by a dependency test (api/-import-policy precedent). The four hardcoded lists (census C1–C4) are generated from the registry — build fails on drift. (Generation lands Phase 3; the test lands with the registry in Phase 2.)

**DR-7 (PROPOSED)** — unchanged (wire-or-delete per dead field), dispositions recorded in Appendix D.
**DR-8 (PROPOSED)** — unchanged (`personality.traits` retirement); writer-retirement sequence now specified in Appendix C.
**DR-11 (PROPOSED)** — unchanged (kernel-only immutability).
**DR-13 (PROPOSED — AMENDED)** — eval-time identity block, now with defined precedence (R1 finding 27): the block renders kernel content **plus an explicit subordination clause** stating the ladder ("platform limits and enforced values override this; your equipped rules refine but never reverse these principles"). Structural contradiction prevention remains the compat map's job (true kernel-reversals are non-equippable, `core_conflict`); `tension` rules rendered alongside the identity block are recorded in `manifest.renderedTensionPairs[]`. Flip gated on the two-stage validation of DR-10.

---

## 3. UserBuildDelta contract

Field set unchanged from V1.0 §3. Three additions:

### 3.2 Build identity + atomicity (R1 findings 19, 20)

- **Single revision authority:** `settingsRev` (existing monotonic per-agent counter) is THE build revision counter. Phase 2 extends its coverage so **every behavior-affecting mutation bumps it** — including bundle content edits while a bundle is equipped (today's coverage gap). `buildMeta.buildVersion` is a named pointer to a `settingsRev` value assigned at deploy/naming.
- **`bundleContentHash`:** computed at compile over each equipped bundle's behavior-affecting fields (`ruleIds`, `ruleSnapshots`, `ruleHardness`→retired per §5.4, `dimensionValues`, params). Any post-compile mutation invalidates dependent CompiledBuilds — recompile required before next deploy. (Alternative — extending the firestore equipped-content freeze to dimension fields — is logged pending the persist-on-launch constraint check in Phase 2 discovery.)

### 3.3 Parent version rules (R1 finding 22)

Builds compile against their **exact** `parentIdentityVersion`. A missing/retired version fails compilation explicitly (no silent fallback to latest). Rebase to a newer identityVersion is a deliberate act: new `buildVersion`, full compat re-verdict recorded in CompiledBuild.

**Appendix C (NEW — R1 finding 21)** carries the delta field census: storage home / owner / readers / writers / version trigger / freeze rule / retirement sequence for every field above, seeded from Census Maps 4–5. Phase 2 discovery completes the writer column.

---

## 4. Compilation artifacts

### 4.1 ResolvedAgentManifest

V1.0 §4.1 schema retained with these amendments:

- `guardrails` layer now records `{ userGuardrails (source, never mutated), compiledRuleGuardrails[] (with guardrailBinding + sourceRuleId), effectiveGuardrails (merged snapshot) }` — the merge exists **only** here and in CompiledBuild; `deployedStrategy.guardrails` is never overwritten (R1 finding 10).
- `freezePolicyVersion` stamped at creation; battles keep their birth policy; mutation endpoints consult the battle stamp (R1 finding 2).
- `renderedTensionPairs[]` added (DR-13 amendment).
- **Create-only after battle start** (R1 finding 4): repair/backfill may append a superseding manifest only before first evaluation; in-flight battles retain their original. DR-6 amended accordingly.

### 4.2 DR-2 (PROPOSED — AMENDED) — freeze split, unchanged in substance

Platform calibration live-at-tick; user configuration (incl. reclassified `strategyPreset`) frozen at lock; intervention tiers per GameModePolicy. Amendments: `freezePolicyVersion` transition rule (above); provenance obligations moved to §4.3 so live calibration is truthfully attributable.

### 4.3 Version truth: lock-state vs execution-state (R1 findings 1, 24)

Two distinct records, never conflated:

- **`CALIBRATION_BUNDLE_VERSION`** (NEW constant): one monotonic version covering every live physics table — hftConfig, ARCHETYPE_WEIGHTS/TEMPERATURES/CONSTRAINTS, preset levers, tempo bands. Bumped on any table change; per-table sub-versions optional later.
- **Manifest** stamps `…AtLock` versions + values (historical record of lock).
- **Every DecisionReceipt** carries `effectiveRuntimeResolution` captured **during the tick**: `{ calibrationBundleVersion, knobConfigVersion, dialBandVersion, modelId, promptSpecVersion, guardrailSetVersion, gameModePolicyVersion, commitSha }` (commit SHA already available at the tick — control-epoch telemetry precedent). Retrievability of any referenced state is via git + the per-version calibration snapshot artifact; no runtime artifact store.

Replay contract: a decision replays against `effectiveRuntimeResolution`; a build explains against the manifest; divergence between the two is *itself* recorded truth (a mid-battle rebalance), not an error.

### 4.4 CompiledBuild contract (NEW — R1 findings 3, 12, 30)

The per-save compiler output; the preview the user confirms; the atomic bridge to lock.

```
CompiledBuild {
  compiledBuildId, compilerVersion, compiledAt, contentHash
  agentId, buildVersion (settingsRev pointer), parentArchetypeId, parentIdentityVersion, identityHash
  sourceRevisionVector { settingsRev, bundleContentHashes{bundleId:hash}, ruleLibraryVersion,
                         identityHash, calibrationBundleVersion, guardrailSetVersion }
  validation { pass|fail, errors[] }
  compatVerdicts[]           // per rule: native|compatible|tension(treatment)|core_conflict(blocked)
  blockedControls[]          // compile-time blocks live HERE (not in runtime receipts — R1 finding 16)
  effectiveGuardrailsPreview {
    perType: { requestedByUser, derivedFromRules[{ruleId, value, binding}],
               effective, governingSource, onUnequipBehavior }   // mandatory — R1 finding 12
  }
  freshness { validUntilSourceChange:true }   // any sourceRevisionVector component change invalidates
}
```

**Lock atomicity (DR-12 AMENDED — R1 finding 3):** the deploy path compiles (or validates a fresh CompiledBuild), then the lock transaction **re-verifies the sourceRevisionVector** (settingsRev unchanged, bundle hashes unchanged) before writing manifest+battle; mismatch aborts and retries. Save is blocked whenever `effective ≠ requested` and the conflict preview was not presented (R1 finding 12).

**DR-9, DR-10 (AMENDED), DR-12 (AMENDED)** otherwise as V1.0. DR-10 now two-stage: assembly shadow (structural, Phase 2) + **offline paired-evaluation harness** — captured live contexts replayed off-cron through the API against candidate prompts, measuring input size, truncation, latency, citation, refusal compliance, and action divergence — required before any behavior-affecting flip (manifest-read migration, identity block, preset freeze) (R1 finding 28).

---

## 5. Rule metadata + enforcement

### 5.1 Corpus metadata fields (amended)

As V1.0 §5.1 with renames/additions: `enforcementMode` → **`intendedMode`**; add **`secondaryEffects[]`** (optional; R1 finding 7); add **`guardrailBinding?`** `{ type, scope(position|portfolio), basis(entry|trailing|hwm), unit(pct|atr), trigger, side, resetBehavior, evaluationTiming }` — required for any rule eligible for guardrail compilation (R1 finding 9); `hardness` is **not** an authored field (derived — §5.4).

### 5.2 Compatibility map — unchanged (four classes via additive `tension`; INVARIANT R preserved; compat outcomes live in CompiledBuild/manifest only).

### 5.3 DR-3 (PROPOSED — AMENDED) — intent vs effect (R1 finding 5)

Two fields, both in the manifest per rule:

- **`intendedMode`** (authored): `eligibility_constraint | execution_constraint | scoring_modifier | required_consideration | tie_breaker` (+ `secondaryEffects[]`).
- **`effectiveEnforcement`** (compile-derived): `deterministic` (a guardrailBinding compiled, or a platform/knob gate owns it) or `prompt_advisory` (everything else at launch).

A constraint-intended rule with `prompt_advisory` effect renders under advisory framing, carries `copyClass:'advisory'`, and is **never** presented to users or metrics as enforced. The enum is a taxonomy of intent; effect is a separate, honest, derived fact. Receipts, saturation metrics, and form guides key off `effectiveEnforcement` only.

### 5.4 Authority + legality (R1 findings 6, 8)

- **Hardness is a derived legacy projection**: `intendedMode ∈ {eligibility_constraint, execution_constraint} → renders in CONSTRAINTS section`, else STRATEGY PREFERENCES. The authored per-rule `ruleHardness` override retires when metadata authoring completes (migration: existing overrides translate to intendedMode assignments). Single authoritative field; the prompt renderer needs no change.
- **Legal-combination matrix**: `tension`+`advisoryDowngrade` forces `effectiveEnforcement:'prompt_advisory'` + advisory rendering regardless of intendedMode; `core_conflict` never compiles; `tie_breaker` intendedMode is legal only for lean-class content. Compile-time rejection of illegal pairs.
- **Fallback legality**: for `effectiveEnforcement:'deterministic'`, `missingDataFallback ∈ {abstain, block}` only (or compilation fails); `ignore_rule` is legal solely for `prompt_advisory`. Failing open on stale data is prohibited for anything enforced.

### 5.5 DR-4 (PROPOSED — AMENDED) — guardrail compilation (R1 findings 9, 10, 11)

- Compile **only exact semantic matches** per `guardrailBinding` (all eight descriptor fields must match a supported guardrail engine shape). Non-matching "guardrail-ish" rules stay `prompt_advisory` — no lossy coercion.
- Merge policy across compiled + user values of the *same binding*: strictest-wins, computed only in CompiledBuild/manifest, with the mandatory preview (§4.4). User source values never mutated; unequip restores by construction.
- **No double rendering**: a compiled rule is excluded from the CONSTRAINTS text and replaced with a system-enforcement notice: "The platform enforces {value} for {behavior}. Do not tighten or reinterpret this limit." Prevents the model second-guessing the deterministic layer.
- Honest-copy program unchanged (advisory rewording batch; maxPosition downgrade rides the census remediation arc).

### 5.6 Phase-2 activation gate (NEW — R1 finding 31)

The compiler ships dark and **cannot activate** in production until the metadata completeness gate passes: `intendedMode` + `copyClass` + `receiptTag` present for 143/143 templates; `detectorSource` + `guardrailBinding` + `missingDataFallback` present for every rule whose compilation would yield `effectiveEnforcement:'deterministic'`. Compiler development uses fixture metadata; **no permissive production defaults are ever invented**. Until the gate passes, production behavior is byte-identical to today's pipeline.

---

## 6. Decision records of behavior (receipts)

### 6.1 DR-5 (PROPOSED — AMENDED) — substrate unchanged (extend `learningReceipts`; outcome-blind; create-only), structure amended throughout per R1.

### 6.2 Per-decision receipt additions

```
receipt.controls {
  manifestId, manifestHash
  rulesRendered[]            // renamed from rulesInScope (R1 finding 15) — proves rendering, not attention
  deterministicEvents[]      // RUNTIME gates only (knob gates, guardrail fires, sector cap, freshness
                             //   abstentions) — compile-time blocks excluded (R1 finding 16)
  modelAttestations { citedRules[], overriddenRules[], evidenceClass:'model_self_report' }
                             // class excluded from all proof/saturation/fingerprint metrics (R1 finding 18)
  leanState[], dialEffective, presetEffective
}
receipt.versionsAtLock       // from manifest
receipt.effectiveRuntimeResolution   // §4.3 — captured at tick (R1 finding 1)
```

### 6.3 Non-action records (AMENDED — R1 finding 14)

- **Per-evaluation gate aggregate** (one record per battle per tick): `{ candidatesTested, blockedCountsByGate{gateTag:n}, samplingMeta:none }` — complete denominators, no per-candidate write storm.
- **Terminal-gate record**: when an evaluation ends in no action, the single gate responsible is recorded **unsampled** `{ terminalGate, proposedAction?, reason }`.
- Individual `blockedActionEvent` docs are reserved for deterministic blocks of a *specific proposed action* (Haiku proposed a swap; a gate vetoed it) — bounded volume by construction.

### 6.4 Settlement record (AMENDED — R1 findings 13, 17)

Relocated to its own home: **`battleSettlements/{battleId}`** (Admin-only, separate from `learningReceipts` — the learning collection stays outcome-blind with no settlement queries crossing it). Write pattern: attempted in `completeBattle`'s post-commit block with an idempotent retry marker; the settlement transaction's battle update stamps `receiptCoverage: complete|failed|pending` so absence-of-record is distinguishable from zero-events. Contents: manifestId/hash, final score state, deterministic-event totals, coverage stats.

---

## 7. Fingerprint + FormGuide — as V1.0 §7, plus: all fingerprint/saturation computations consume `deterministicEvents` + gate aggregates only; `model_self_report` evidence is excluded from proof metrics by class (R1 finding 18).

## 8. Freeze policy — as V1.0 §8, plus `freezePolicyVersion` row: stamped at creation; battles honor birth policy; endpoints consult the stamp.

## 9. Fence contacts — as V1.0 §9, plus: registry import-boundary test (non-fenced); `battleSettlements` writes (non-fenced, completeBattle attach); settingsRev coverage extension touches equip endpoints (non-fenced) and possibly bundle write paths (rules file — founder deploy dependency stands).

## 10. Open questions (updated)

- Q-1 (blocked-event volume): **RESOLVED** by §6.3 aggregates.
- Q-2 (strictest-wins UX): **RESOLVED** by §4.4 mandatory preview + §5.5 source separation.
- Q-3 (model/prompt pinning for vehicles): open; manifest now records both at lock and per tick, so Phase 6 can pin without schema change — decision deferred with evidence path defined.
- Q-4 (dual collection catalogs): open, decision required before build naming ships (Phase 4).
- Q-5 (blockedControls disclosure UX): partially resolved — CompiledBuild preview is mandatory for guardrail conflicts; broader progressive-disclosure design remains Phase 4.
- **Q-6 (NEW):** settingsRev coverage extension — does bumping on client-side equipped-bundle dimension writes require a server mediator (rules deny agent-doc client writes), or does the bundleContentHash invalidation alone suffice? Phase 2 discovery answers.

## 11. Acceptance criteria (Phase 1 exit) — as V1.0 with: thirteen DRs ruled **with Appendix B dependencies visible**; §5.6 gate + §4.3 version constants specified; Round 2 delta review returns LOCK-READY.

---

## Appendix A — Decision Record index (13)
DR-1 three objects · DR-2 freeze split + preset + tiers + freezePolicyVersion (AMENDED) · DR-3 intent/effect enum split (AMENDED) · DR-4 guardrail compilation w/ semantic binding + source separation + no double render (AMENDED) · DR-5 receipts: rendered/attestation/aggregates/settlement-relocation (AMENDED) · DR-6 manifest on battle doc, create-only post-start (AMENDED) · DR-7 dead fields · DR-8 personality.traits retirement · DR-9 caps now · DR-10 two-stage shadow (AMENDED) · DR-11 kernel-only · DR-12 compile-at-equip + atomic lock verify + activation gate (AMENDED) · DR-13 identity block w/ precedence clause (AMENDED).

## Appendix B — DR dependency matrix (R1 finding 32)

| If rejected → | Consequence |
|---|---|
| DR-1 | DR-6, DR-12, §4.4 invalid (no separate manifest to compile) — program redesign |
| DR-2 | DR-6/DR-12 survive but manifest layers collapse to record-only; §4.3 still required |
| DR-3 | DR-4 loses its mode substrate; §5.4–5.6 invalid; receipts fall back to hard/soft tagging |
| DR-4 | DR-3 survives; all rules `prompt_advisory` at launch; §4.4 preview shrinks; honest-copy program becomes mandatory everywhere |
| DR-5 | Phase 5 fingerprints lose their evidence source; DR-9's "displacement later" loses its later |
| DR-6 | DR-12 lock-verify has no write target; manifest must find another home (redesign, not removal) |
| DR-12 | DR-6 unreachable at runtime; CompiledBuild becomes advisory-only preview |
| DR-13 | Phase 3 constitutions have no tick-time effect (F5 persists); DR-10 stage-2 harness still needed for manifest migration |
| DR-7/8/11 | Independent; registry carries dead weight / dual trait channels persist / kernel boundary blurs |
| DR-9/10 | Independent sequencing choices |

## Appendix C — Delta field census (skeleton; Phase 2 discovery completes writers column)
Per field (equippedBundleIds, bundles.*, rules.*, equippedTraits, standingLeans, dials.tempo, equippedWatchlist*, deployedStrategy.guardrails, strategyPreset, buildMeta): storage home · owner · readers · writers · version trigger (settingsRev? y/n today vs V1.1 target) · freeze rule · retirement sequence (where applicable: personality.traits, ruleHardness override, mid-battle preset writer).

## Appendix D — Migration decision artifact (stub)
`deadFieldDispositions` per DR-7 (moved from runtime schema — R1 finding 26): convictionMods→DELETE · sectorConcentrationCap→WIRE-or-DELETE pending SECTOR_CAP ruling · regimePreferences.canEnterDistressed/avoided→DELETE · tradeFrequency→DELETE · favoredStrategies→KEEP. Ratified at DR-7 ruling; executed Phase 3.
