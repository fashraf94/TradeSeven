# COMPOSITION ACTIVATION RUNBOOK — the script the founder executes live

**Governs:** the `ARCHETYPE_IDENTITY_VERSION` composition event's activation (identity v2 → v3). · **Basis:** Spec V0.9 §8/§10 as amended by the closure sheet §V, `ACTIVATION_PRECONDITIONS.md` (every PR-4 row), and the founder rulings of Aug 6–7, 2026 (Q1 boundaryStateVersion, Q2 A24, Q3 substitution policy, the 7-field descriptor union, the clean rename). · **Posture at merge:** everything below is DEPLOYED INACTIVE — flags dark, no activation record, byte-identical production behavior. Nothing in this document runs at merge; the founder runs it live, step by step, each step with a named VERIFY and a named ROLLBACK point.

**The one rollback mechanism (A29/A45/A49):** atomic repoint of the **prior descriptor** — `rollbackActivationRecord(db, { toGeneration })` repoints the COMPLETE prior tuple from the append-only history under a strictly-greater generation. The catalog holds every version immutably; **nothing is ever "restored"**; the abandoned epoch's overrides silently leave resolution and never resurrect. Before the record exists (steps 0–6), "rollback" = stop; nothing has changed.

**Standing rules for the window:** **once step 7 has run, `COMPOSITION_EPOCH_FENCE_ENABLED` NEVER lowers** — post-activation it is load-bearing for the server-side descriptor pins (birth-path version selection, projection guard, FC-1 stamping); lowering it splits identity selection instead of deactivating (§2 review F5); deactivation is `rollbackActivationRecord`, nothing else. Also: the §6/§8 freeze holds (no new builds/births/enforced saves); every row of `EXTERNAL_ADMIN_WRITE_PATHS.md` is confirmed paused at the close and resumed at the unfreeze; the A7-LOCK freeze (ACTIVATION_EVIDENCE.json) is in force from step 3 — any movement in a frozen value re-opens the gate chain.

---

## Step 0 — Preflight at the deployed SHA (census re-run + drain gate)

1. Confirm the Vercel production deployment SHA == the merged PR-4 SHA. Record both in the log below.
2. Run **`node scripts/composition/preflight-at-sha.js --sha <deployed-sha>`** (B8-FINAL). It refuses on HEAD mismatch or a dirty tree and re-runs: the A46 writer census, the B3/B3-EXT deny-by-default scan, the composition battery, the fence-behavior suite, the candidate registry + default-trait suites. **Any newly-discovered writer is reconciled BEFORE proceeding** (the PR #716 casualClone precedent).
3. **Drain gate (A26/A35):** no active battle's birth identity may differ from the candidate boundary. Predicate over active `agentBattles`: `resolvedAgentManifest.versionStamps.identityVersionAtLock < ARCHETYPE_IDENTITY_VERSION` **or** `identityHashAtLock != <live registry hash>` ⇒ wait for those battles to complete (battles run ≤ a day). Record the drained count.

**VERIFY:** preflight report green (`validatePreflightReport` at the pinned SHA); drain query returns zero. **ROLLBACK POINT:** nothing changed — stop is free.

## Step 1 — Deploy inactive + close the write epoch

1. The merged deploy IS the inactive deploy (v3 snapshot committed, resolver present, no activation record). Flag flips (`COMPOSITION_EPOCH_FENCE_ENABLED=true`, and `COMPOSITION_COMPILED_IDENTITY_ENABLED=true` for the candidate pipeline steps below) are **flip commits deployed here**, reconciling their own pins in the same commit (§2 flip rule); behavior stays byte-identical — the fence fail-opens pre-close, the candidate boundary is dark by absence (no record, no candidate builds).
2. **B9 gate before the fence flip:** deploy `firestore.rules`; fetch the DEPLOYED text; run the emulator smoke against it (`COMPOSITION_RULES_TEXT_PATH=<fetched> npm run test:rules -- test/rules/compositionEpochDenials.rules.mjs`); fill `docs/composition/RULES_DEPLOY_RECORD.json`; **`node scripts/composition/check-rules-deploy-gate.js` must PASS.**
3. **Close the epoch:** write `composition/writeEpoch {state:'closing', epochId:<new>}` → new writes + lease acquisitions reject → **drain provisioner leases** (`drainProvisionerLeases`; B2 — bounded by TTL, stuck holders named) → write `{state:'closed'}` — **the watermark**. Pause every EXTERNAL_ADMIN_WRITE_PATHS row (checklist signed).
4. **Watermark sweep (B8):** every protected-store doc updated after the watermark must be attributable to a named runbook step.

**VERIFY:** B9 gate PASS; drain result `{drained:true}`; fence suite semantics live (a probe write 409s `epoch_closed`). **ROLLBACK POINT:** write `{state:'open'}` + resume the paused rows — nothing else changed.

## Step 2 — FINAL-DRYRUN (hard gate; founder ratifies the exact counts)

Run **`node scripts/composition/migration-scan.js`** (dry-run) at the deployed SHA against the closed fleet. The report carries `activeIdentityVersion: 3`, the affected-agent/entry/report-class counts, `semanticHash`, `runHash`.

**HARD GATE:** the founder records ratification of the EXACT counts (this file's log, below) — required because A11 moved the migration population (the six former needsBinding rows now clamp) and the item-6 substitutions (incl. the two beyond-item-6 hosts, if ratified) change the DEFAULT_TRAITS surface. `--apply` refuses without this ratification. **The A7-LOCK freeze is in force from here.**

**VERIFY:** two consecutive dry-runs agree on `semanticHash` (M12 — the runId-independent identity). **ROLLBACK POINT:** reopen the epoch (step 1 rollback); no state written.

## Step 3 — `--apply` (Method B overlay, candidate namespace only)

**`node scripts/composition/migration-scan.js --apply --yes`** — writes overlay entries + the run doc (the completion sentinel, entries-first order) into `compositionCandidateState/{runId}`. Base records untouched (A32/A36/A38).

**VERIFY:** the apply summary's `semanticHash` equals the ratified dry-run's; `entryCount` equals the ratified entry count. **ROLLBACK POINT:** the candidate namespace is inert (nothing reads it without the record) — abandon the runId and stop, or proceed.

## Step 4 — Zero-residual verification through THE resolver

Re-run the scan in verify mode: the scanner observes base+overlay through `resolveEffectiveConfig` and must report **zero residuals** (A42); an old-identity read still observes pure base.

**VERIFY:** `RESIDUALS_AFTER_PLAN` empty for every agent. **ROLLBACK POINT:** same as step 3.

## Step 5 — Candidate-scoped pipeline, in the Phase-0-proven order (A37)

With the candidate flags deployed (step 1) and the record still absent, run the candidate pipeline **scoped to the candidate namespace**: enable candidate manifest writing → **candidate-compile step** → verify candidate manifests → enable candidate shadow assembly → verify candidate shadow. (The compiled builds minted here carry the candidate vector fingerprint — `projectedRulesHash` — and, until the X6 base-metadata arc, `metadata_missing` validation entries; the honest-expectations rider of §II applies: **no gate-green is claimed by this event**.)

**VERIFY:** candidate builds carry `projectedRulesHash`; manifests rev-match; shadow capture manifest-anchored. **ROLLBACK POINT:** candidate artifacts are self-invalidating (vector-keyed); abandon and stop.

## Step 6 — Stale-artifact sweep

Sweep the item-10 census locations (A15): every stored artifact whose source vector predates the candidate boundary must read STALE through its own reader (`diffSourceRevisionVector` presence-aware compare — the 3.5 F1 fix). Record the sweep output.

**VERIFY:** every stale location rejects/recompiles; none serves. **ROLLBACK POINT:** unchanged — stop is still free.

## Step 7 — WRITE THE ACTIVATION RECORD (the flip)

**`writeActivationRecord(db, { activeIdentityVersion: 3, boundaryStateVersion: 1, activeEpochId: <the step-1 epoch>, candidateStateId: <runId>, semanticHash: <ratified> })`**

One transaction: R6-B1 (descriptor vs candidate manifest) + M6 (exact entryCount, recomputed semantic hash, create-only ids, no stale extras) verify INSIDE it — any defect aborts with nothing repointed. The writer mints generation MAX+1 and appends the history row. `boundaryStateVersion` starts at **1** (Q1 ruling); `overrideRevision` at 0. Per-boundary states ride this record — no independent flag flips at the flip.

**VERIFY:** the loader returns `{activated:true, generation:1}` with the full 7-field descriptor; the B1 posture flips (absent epoch doc would now fail closed). **ROLLBACK POINT (from here on):** `rollbackActivationRecord(db, { toGeneration: <prior> })` — the atomic repoint of the prior descriptor.

> **⚠ OPEN DESIGN POINT (§2 review F2 — UNWRITTEN, founder ruling needed BEFORE the live run):** the FIRST activation has no prior descriptor generation to repoint to — `rollbackActivationRecord` correctly refuses (`toGeneration` must be a strictly prior history row). Rolling the first activation back to the PRE-ACTIVATION world (record absent) is not representable within the written no-tuple-reuse + sole-authority constraints without a ruling: deleting the record would re-mint generation 1 on a later activation (tuple reuse, the ABA class B1-EXT forbids); a live-version-pointing descriptor would need written semantics for overlay non-participation. Until ruled, step 7 of the FIRST run is the point of no return — the §10 defect path is fix-forward (or a ruled mechanism lands first).

## Step 8 — §10 post-flip checks, then unfreeze

**Positive checks:** a new battle's manifest carries the FC-1 stamps (`compositionSourceGeneration` = the record's generation, slice stamp equal); a trait-hosted tension renders its advisory exactly once in a live prompt; a birth seeds the SUBSTITUTED defaults (guardian: `alloc-sector-cap`; the record is what selected them — A24).

**NEGATIVE checks (each observed, not assumed):**
- `core_conflict` **absent** from a live prompt (equip a banned pairing via the client SDK; compile blocks it; the prompt renders nothing for it);
- `deferred` **absent** the same way;
- **stale-build rejection observed**: a pre-flip compiled build reads STALE through `diffSourceRevisionVector` and recompiles — never serves;
- **out-of-domain save rejected BY THE VALIDATOR through the freeze-passing path**: an in-window save carrying an out-of-domain param 409s from `checkCandidatePairing` at the endpoint (the A7 kernel — not the freeze, not the fence);
- **identityHash equality**: the served identity's hash equals the v3 snapshot's `identityHash` (catalog lock recompute).

**ACTION_COPY checkpoint:** founder reviews the user-facing product copy (identityMigration feed entries via `projectIdentityMigrationFeed` under A44, advisory sentences on live prompts, renamed trait cards) — a copy defect here is a STOP-and-fix before unfreeze, not after.

**M7 live measurement:** capture one real eval request's `usage.input_tokens` + one draft request's and record them against the M7-E2E budgets (the chars/4 estimates must over-state the real counts).

**Unfreeze:** resume the EXTERNAL_ADMIN_WRITE_PATHS rows; lift the §6/§8 freeze; `COMPOSITION_MIGRATION_FEED_ENABLED` flips only after the record is verified (A44, flag-ownership table); purge the lease registry (`purgeReleasedProvisionerLeases` — §2 review F9).

**VERIFY:** every check above recorded in the log with its observation. **ROLLBACK:** the step-7 rollback, any time.

## Step 9 — PR 5 docs closeout

The `--apply` report, zero-residual output, preflight reports, watermark sweep, the filled RULES_DEPLOY_RECORD, the §10 observations, and this log → `docs/audits/` in a docs-only PR 5. The ledger's PR-4 rows move to CLOSED with their observations cited.

---

## M10 — per-boundary evidence checklist (fill at step 1, verify at step 7)

Observe-window evidence is **equip-bundle only** (PR 2 instrumented that boundary); every other boundary activates on the B8 behavioral suite + this PR's acceptance batteries. State which, per boundary:

| Boundary | Evidence class | Filled at run |
|---|---|---|
| equip-bundle | PR-2 observe telemetry + B8 row | |
| other 10 endpoints | B8 behavioral suite (45 rows) + endpoint suites | |
| deploy gate (decide.js) | generation-fence suite (both directions) | |
| battle writer (FC-1) | cutover-interleaving suite | |
| provisioners | B2 lease suite + fence rows | |
| client SDK writers | rules-layer denials (B9-gated deployed text) | |
| background loops | census guard tokens + pause checklist | |

## Run log (append-only; the founder fills during the run)

| Step | Started | Result / counts | Verified by | Operator |
|---|---|---|---|---|
| 0 | | | | |
| 1 | | | | |
| 2 (RATIFICATION) | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 (FLIP) | | | | |
| 8 | | | | |
| 9 | | | | |
