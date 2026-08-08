# COMPOSITION ACTIVATION RUNBOOK — the script the founder executes live

**Governs:** the `ARCHETYPE_IDENTITY_VERSION` composition event's activation (identity v2 → v3). · **Basis:** Spec V0.9 §8/§10 as amended by the closure sheet §V, `ACTIVATION_PRECONDITIONS.md` (every PR-4 row), and the founder rulings of Aug 6–7, 2026 (Q1 boundaryStateVersion, Q2 A24, Q3 substitution policy, the 7-field descriptor union, the clean rename). · **Posture at merge:** everything below is DEPLOYED INACTIVE — flags dark, no activation record, byte-identical production behavior. Nothing in this document runs at merge; the founder runs it live, step by step, each step with a named VERIFY and a named ROLLBACK point.

**The one rollback mechanism (A29/A45/A49 + the F2 GENESIS ruling; scope per Sol's pre-activation review #1/#12):** atomic repoint of the **prior descriptor** — `rollbackActivationRecord(db, { toGeneration })` repoints the COMPLETE prior tuple from the append-only history under a strictly-greater generation, executed only through **THE ROLLBACK PROTOCOL** (its own section below). **The guarantee, stated honestly:** rollback is **TOTAL while the fleet is frozen** (through step 8A — no v3 base state exists anywhere, so the selector repoint restores the pre-activation world exactly; proven rows). **During 8B** the only v3 base state is the ENUMERABLE operator probe identities — reversed by the named hand reconciliation listed in the protocol. **After general unfreeze,** rollback is **selector-total plus that reconciliation** (base state born under v3 is not reversed by the repoint — the honest-divergence regression row records this). **Rollback-to-genesis is claimed for THIS event only** (generation 2 → 1); an arbitrary-generation rollback claim is FILED post-event behind its prerequisite (immutable per-revision override snapshots / frozen final epoch revision — the ledger's filed item). The catalog holds every version immutably; **nothing is ever "restored"**; the abandoned epoch's overrides silently leave resolution and never resurrect. Before genesis, "rollback" = stop; nothing has changed.

**Standing rules for the window:** **once step 7 has run, `COMPOSITION_EPOCH_FENCE_ENABLED` NEVER lowers** — post-activation it is load-bearing for the server-side descriptor pins (birth-path version selection, projection guard, FC-1 stamping); lowering it splits identity selection instead of deactivating (§2 review F5); deactivation is `rollbackActivationRecord`, nothing else. Also: the §6/§8 freeze holds (no new builds/births/enforced saves); every row of `EXTERNAL_ADMIN_WRITE_PATHS.md` is confirmed paused at the close and resumed at the unfreeze; the A7-LOCK freeze (ACTIVATION_EVIDENCE.json) is in force from step 3 — any movement in a frozen value re-opens the gate chain.

---

## Step −1 — Rules deploy IMMEDIATELY after merge (the L1-1 window)

**Run within minutes of the merge deploy** (founder ruling, Aug 7): the client birth path reads `composition/activation` on every agent creation by design (A48 — the record is the only selector; no client flag). Until the merged `firestore.rules` read clause is DEPLOYED, that read is DENIED — writes stay byte-identical (every failure resolves LIVE, time-boxed at 1.5 s), but each birth carries one rejected round trip. **This step closes that window operationally.**

1. Deploy `firestore.rules`; fetch the DEPLOYED text; run the emulator smoke against it (`COMPOSITION_RULES_TEXT_PATH=<fetched> npm run test:rules -- test/rules/compositionEpochDenials.rules.mjs`); fill `docs/composition/RULES_DEPLOY_RECORD.json`; **`node scripts/composition/check-rules-deploy-gate.js` must PASS** (the B9 gate — it runs HERE now; step 1 re-verifies it).

**VERIFY:** B9 gate PASS; a client read of `composition/activation` while signed in returns not-found (allowed, record absent) instead of permission-denied. **ROLLBACK POINT:** nothing else changed — stop is free.

## Step 0 — Preflight at the deployed SHA (census re-run + drain gate)

1. Confirm the Vercel production deployment SHA == the merged PR-4 SHA. Record both in the log below.
2. Run **`node scripts/composition/preflight-at-sha.js --sha <deployed-sha>`** (B8-FINAL). It refuses on HEAD mismatch or a dirty tree and re-runs: the A46 writer census, the B3/B3-EXT deny-by-default scan, the composition battery, the fence-behavior suite, the candidate registry + default-trait suites. **Any newly-discovered writer is reconciled BEFORE proceeding** (the PR #716 casualClone precedent).
3. **Drain gate (A26/A35) — ADVISORY here (Sol review #7):** no active battle's birth identity may differ from the candidate boundary. Predicate over active `agentBattles`: `resolvedAgentManifest.versionStamps.identityVersionAtLock < ARCHETYPE_IDENTITY_VERSION` **or** `identityHashAtLock != <live registry hash>` ⇒ wait for those battles to complete (battles run ≤ a day). Record the drained count. This early run is a scheduling aid — **the HARD gate is the post-watermark repeat at step 1.10**, because battles can start between this check and the close.

**VERIFY:** preflight report green (`validatePreflightReport` at the pinned SHA); drain query returns zero. **ROLLBACK POINT:** nothing changed — stop is free.

## Step 1 — Deploy the flip commits, pin the ACTIVATION SHA, write GENESIS, close the write epoch

*(Ordering per Sol's pre-activation review #8/#4/#9: deploy FIRST → preflight at the final deployed SHA → drain old invocations → pause admin BEFORE any epoch-state write → snapshot smoke BEFORE genesis.)*

1. **Deploy the flip commits FIRST** (`COMPOSITION_EPOCH_FENCE_ENABLED=true`, and `COMPOSITION_COMPILED_IDENTITY_ENABLED=true` for the candidate pipeline steps below — flip commits reconciling their own pins, §2 flip rule) and **WAIT for the deployment to be live**. Behavior stays byte-identical — the fence fail-opens pre-close; the candidate boundary follows THE RECORD (#11: `resolveCandidateModeInTx` — no record / genesis ⇒ live cells; the flag is only the dark switch).
2. **Re-run the COMPLETE step-0 preflight at the final deployed SHA** (`preflight-at-sha.js --sha <deployed>`), then **record that SHA as THE ACTIVATION SHA** in the log. **No further commits or deploys after this point** — any commit re-opens step 1 from 1.1.
3. **Old-deployment-invocation drain (#8):** invocations of PREVIOUS deployments may still be executing. Wait out the platform's maximum function lifetime (Vercel: the configured `maxDuration` ceiling) — or trigger the explicit drain signal if one exists — and record the wait. Nothing that follows may race code from a prior SHA.
4. **B9 re-verification:** the rules deploy + gate ran at step −1; confirm `check-rules-deploy-gate.js` still PASSES against the filled record at the activation SHA.
5. **Pause + POSITIVELY ACKNOWLEDGE every external admin writer (#4 — BEFORE any epoch-state write):** every row of `EXTERNAL_ADMIN_WRITE_PATHS.md` is paused AND each pause is positively acknowledged (per-row sign-off in the checklist: operator, timestamp, mechanism). No `state:'closing'` write may precede the last acknowledgment.
6. **Open the epoch EXPLICITLY:** write `composition/writeEpoch {state:'open', epochId:<E0, new>}` — today's implicit fail-open world made explicit. Required now: the genesis write arms B1, and the armed world must never see an absent epoch doc.
7. **Deployed-lambda snapshot smoke (#9 — BEFORE genesis):** invoke a REAL deployed path that resolves **v2 via the bundled historical snapshot** AND **v3 via the catalog** (the F7 `includeFiles` verification made concrete — e.g. an internal-caller probe of the version-parameterized resolver at both versions). **Record BOTH identity hashes** in the log; they must equal the catalog-lock values. **Failure ⇒ do NOT write genesis** — stop, fix the bundling, redeploy, restart from 1.1.
8. **GENESIS (the F2 ruling — BEFORE the epoch close, paired with the open epoch doc):** **`writeGenesisDescriptor(db, { activeEpochId: '<E0>' })`** — generation 1 = the genesis descriptor `{activeIdentityVersion: 2 (live), boundaryStateVersion: 1, candidateStateId: 'genesis', semanticHash: <the reserved null-sentinel>, activeEpochId: E0, overrideRevision: 0}`. No overlay participation — the loader short-circuits to base-only; births, reads, and compiles are UNCHANGED (proven rows incl. the genesis-present pipeline row). The write validates the open epoch pairing in its own transaction and refuses if any record exists. **From this write on: B1's absent-epoch-doc-fails-closed is armed coherently, and a prior descriptor exists for every future generation.**
9. **Close the epoch:** update `composition/writeEpoch` to `{state:'closing'}` → new writes + lease acquisitions reject → **drain provisioner leases** (`drainProvisionerLeases`; B2). **A lease that expires without release does NOT drain (#3):** the drain REFUSES and names the holder — verify the holder process is dead (the max-function-lifetime bound of 1.3), then `resolveStuckProvisionerLease(db, leaseId, { operator, reason })` (attributed in the log), and re-run the drain. Then `{state:'closed'}` — **the watermark**. (The epoch doc is UPDATED, never deleted — post-genesis an absent doc fails closed everywhere.)
10. **Battle-drain HARD GATE (#7 — the post-watermark repeat of A26/A35):** re-run the step-0.3 predicate over active `agentBattles` NOW, after the watermark. **This result — not step 0's — is the gate:** any battle matching the predicate ⇒ wait for it to complete before step 2. Record the post-watermark count (expected 0).
11. **Watermark sweep (B8):** every protected-store doc updated after the watermark must be attributable to a named runbook step.

**VERIFY:** preflight green at the activation SHA; both snapshot-smoke hashes recorded and catalog-equal; B9 gate PASS; the loader returns `{activated: true, genesis: true, generation: 1}` and — **the NON-WRITING birth check (re-review #7)** — the seed plan RESOLVED under the genesis-selected version (`selectIdentityVersion` → `buildSeedPlan`) equals the live defaults, a pure computation with zero writes (the fleet is closing/closed here; the behavioral proof is the birth-parity suite row, re-executed as a resolution, not a write); drain result `{drained:true}` with zero unresolved stuck leases; post-watermark battle predicate = 0; fence suite semantics live (a probe write 409s `epoch_closed`). **ROLLBACK POINT:** reopen (`{state:'open', epochId: E0}`) + resume the paused rows (each resume acknowledged) — genesis stays: it is generation 1 forever, selects the live identity, and changes no behavior.

## Step 2 — FINAL-DRYRUN (hard gate; founder ratifies the exact counts)

Run **`node scripts/composition/migration-scan.js`** (dry-run) at the deployed SHA against the closed fleet. The report carries `activeIdentityVersion: 3`, the affected-agent/entry/report-class counts, `semanticHash`, `runHash`.

**HARD GATE:** the founder records ratification of the EXACT counts (this file's log, below) — required because A11 moved the migration population (the six former needsBinding rows now clamp) and the item-6 substitutions (incl. the two beyond-item-6 hosts, if ratified) change the DEFAULT_TRAITS surface. `--apply` refuses without this ratification. **The A7-LOCK freeze is in force from here.**

**VERIFY:** two consecutive dry-runs agree on `semanticHash` (M12 — the runId-independent identity). **ROLLBACK POINT:** reopen the epoch (step 1 rollback); no state written.

## Step 3 — `--apply --during-close` (Method B overlay, candidate namespace only)

**`node scripts/composition/migration-scan.js --apply --yes --during-close`** — writes overlay entries + the run doc (the completion sentinel, entries-first order) into `compositionCandidateState/{runId}`. Base records untouched (A32/A36/A38). **The closed-epoch authorization (Sol review #5, built at the fold):** `--during-close` swaps the general open-epoch guard for the DEDICATED inverse assertion `assertClosedEpochCandidateWindow` — the epoch doc must exist and be `'closed'` (the post-watermark freeze); open/closing/absent each refuse (`candidate_window_not_closed`, tested). **The namespace belt is UNIT-PROVEN (re-review #8):** the apply writer is the extracted `compositionCandidateApply.applyCandidateEntries`, whose mutation row redirects the write set toward `agents/*` and proves the run aborts BEFORE any Firestore write (`compositionCandidateApply.test.js` — zero writes land; sentinel order also pinned there). PR 2's general guard is untouched; without the flag the script still requires an open epoch.

**VERIFY:** the apply summary's `semanticHash` equals the ratified dry-run's; `entryCount` equals the ratified entry count. **ROLLBACK POINT:** the candidate namespace is inert (nothing reads it without the record) — abandon the runId and stop, or proceed.

## Step 4 — Zero-residual verification through THE resolver

Re-run the scan in verify mode: the scanner observes base+overlay through `resolveEffectiveConfig` and must report **zero residuals** (A42); an old-identity read still observes pure base.

**VERIFY:** `RESIDUALS_AFTER_PLAN` empty for every agent. **ROLLBACK POINT:** same as step 3.

## Step 5 — Candidate-scoped pipeline, in the Phase-0-proven order (A37)

With the candidate flags deployed (step 1) and **the record at GENESIS** (#11 — post-genesis the record ALWAYS exists; nothing infers candidate status from its absence), run the candidate pipeline **scoped EXPLICITLY to `{candidateStateId: <the step-3 runId>, activeIdentityVersion: 3}`** — the pipeline tooling passes `candidateMode: true` and the target version as explicit parameters; it never derives candidate status from the flag or the record state (which, at genesis, correctly resolves LIVE for every production compile — the genesis-present pipeline row pins this). Sequence: enable candidate manifest writing → **candidate-compile step** → verify candidate manifests → enable candidate shadow assembly → verify candidate shadow. (The compiled builds minted here carry the candidate vector fingerprint — `projectedRulesHash` — and, until the X6 base-metadata arc, `metadata_missing` validation entries; the honest-expectations rider of §II applies: **no gate-green is claimed by this event**.)

**VERIFY:** candidate builds carry `projectedRulesHash`; manifests rev-match; shadow capture manifest-anchored. **ROLLBACK POINT:** candidate artifacts are self-invalidating (vector-keyed); abandon and stop.

## Step 6 — Stale-artifact sweep

Sweep the item-10 census locations (A15): every stored artifact whose source vector predates the candidate boundary must read STALE through its own reader (`diffSourceRevisionVector` presence-aware compare — the 3.5 F1 fix). Record the sweep output.

**VERIFY:** every stale location rejects/recompiles; none serves. **ROLLBACK POINT:** unchanged — stop is still free.

## Step 7 — WRITE THE ACTIVATION RECORD (the flip)

**`writeActivationRecord(db, { activeIdentityVersion: 3, boundaryStateVersion: 1, activeEpochId: <E1 — a FRESH epoch id>, candidateStateId: <runId>, semanticHash: <ratified> })`**

`activeEpochId` must be **fresh** — A49's history-wide check rejects any epoch id already in history, and **genesis holds E0 at generation 1**, so reusing the step-1 epoch aborts (proven row). One transaction: R6-B1 (descriptor vs candidate manifest) + M6 (exact entryCount, recomputed semantic hash, create-only ids, no stale extras) verify INSIDE it — any defect aborts with nothing repointed; the genesis ids are RESERVED and reject here. The writer mints generation MAX+1 — **the first real activation is generation 2** (Q1 ruling framing: boundaryStateVersion starts at **1**; `overrideRevision` at 0). Per-boundary states ride this record — no independent flag flips at the flip.

**VERIFY:** the loader returns `{activated: true, genesis: false, generation: 2}` with the full 7-field descriptor. **ROLLBACK POINT (scope per #1/#12):** THE ROLLBACK PROTOCOL (below), at any time; **`toGeneration: 1` restores the GENESIS world** — live identity, base-only resolution, base-only compiles (proven rows: rollback-to-genesis in the activation battery, base-only in the loader contract, birth parity in the birth-switch suite, the genesis-present pipeline row). While the fleet is frozen (through 8A) this restoration is TOTAL; from 8B on, the enumerated probe reconciliation applies (see the protocol's scope statement).

## Step 8A — CLOSED verification (everything provable WITHOUT writes; Sol review #6)

The epoch stays **closed**; the fleet is frozen; nothing here writes production state.

- **identityHash equality**: the served identity's hash equals the v3 snapshot's `identityHash` (catalog lock recompute — a read).
- **Loader checks**: `{activated: true, genesis: false, generation: 2}`, full descriptor, seqlock steady.
- **Stale-build rejection observed (read side)**: a pre-flip compiled build reads STALE through `diffSourceRevisionVector` (presence-aware compare) — verified via the gate's verify half without minting a recompile.
- **ACTION_COPY checkpoint:** founder reviews the user-facing product copy (identityMigration feed entries via `projectIdentityMigrationFeed` under A44 in preview, advisory sentences on rendered previews, renamed trait cards) — a copy defect here is a STOP-and-fix before 8B, not after.
- **M7 estimate check:** the chars/4 estimates recomputed against the v3 composition (the live-request measurement happens at 8B when a probe eval runs).

**VERIFY:** every check recorded with its observation. **ROLLBACK:** THE ROLLBACK PROTOCOL — still TOTAL here (no v3 base state exists anywhere).

## Step 8B — CONTROLLED verification-open (named operator probes ONLY), then the general unfreeze

**Open for probes — MECHANICALLY GATED (re-review #4):** update `composition/writeEpoch` to **`{state:'probe', epochId: <E1, the step-7 epoch>, probeIdentities: [<the enumerated operator uids>]}`** (UPDATE, never delete: post-genesis an absent doc fails closed at every boundary incl. the provisioner lease). The gate is CODE-ENFORCED, not operational assertion: the server chokepoint (`validateWriteEpochInTx` + the provisioner-lease acquisition) rejects any actor not in `probeIdentities` — and any writer that doesn't thread an actor at all — with `probe_only` (negative-control row: probe state + non-probe identity ⇒ 409, zero writes); the rules layer denies any client-SDK identity write whose `request.auth.uid` is not listed or whose epoch token is stale (emulator rows). The §6 freeze stays announced, every EXTERNAL_ADMIN_WRITE_PATHS row stays paused, crons stay paused — but none of that is what holds the door: **the probe state does.**

**Probe checks (the §10 positive/negative set that needs writes — each observed, not assumed):**
- a probe birth seeds the SUBSTITUTED defaults (guardian: `alloc-sector-cap`; the record selected them — A24);
- a probe deploy + battle: the new battle's manifest carries the FC-1 stamps (`compositionSourceGeneration` = 2, slice stamp equal); a trait-hosted tension renders its advisory exactly once in the live prompt;
- `core_conflict` **absent** from a live prompt (probe-equip a banned pairing via the client SDK; compile blocks it; the prompt renders nothing for it);
- `deferred` **absent** the same way;
- **out-of-domain save rejected BY THE VALIDATOR through the freeze-passing path**: a probe save carrying an out-of-domain param 409s from `checkCandidatePairing` at the endpoint (the A7 kernel — not the freeze, not the fence);
- **stale-build rejection observed (write side)**: a pre-flip build recompiles at current revision — never serves;
- **M7 live measurement:** one probe eval request's `usage.input_tokens` + one draft request's recorded against the M7-E2E budgets.

**8B FAILURE ⇒ THE ROLLBACK PROTOCOL** (below). The only v3 base state at that point is the enumerated probes' — reversed by the protocol's named hand reconciliation.

**General unfreeze (ONLY after every 8B check passes):** update the epoch doc to `{state:'open', epochId: E1}` — removing the probe gate is what opens general traffic (clients capture the token on their next formed mutation); lift the §6 freeze announcement; resume the EXTERNAL_ADMIN_WRITE_PATHS rows (each resume acknowledged); `COMPOSITION_MIGRATION_FEED_ENABLED` flips only after the record is verified (A44, flag-ownership table); purge the lease registry (`purgeReleasedProvisionerLeases` — released-only, #3/F9).

**VERIFY:** every probe check recorded with its observation + the probe-identity enumeration. **ROLLBACK:** THE ROLLBACK PROTOCOL, any time — scope per its statement.

## THE ROLLBACK PROTOCOL (Sol pre-activation review #2 — symmetric with activation; the ONLY way a rollback runs)

A bare `rollbackActivationRecord` call is never executed alone. The protocol, in order *(re-review #2: the pause-and-acknowledge discipline is IMPLEMENTED in the numbered order — before any epoch-state write; re-review #3: verification splits Rollback-A / Rollback-B, mirroring 8A/8B on the same probe-gate mechanism)*:

1. **Pause external admin FIRST:** every EXTERNAL_ADMIN_WRITE_PATHS row paused + positively acknowledged (per-row sign-off: operator, timestamp, mechanism). No epoch-state write may precede the last acknowledgment.
2. **Close the current epoch:** update `composition/writeEpoch` to `{state:'closing'}` — new writes and lease acquisitions reject from this write on.
3. **Drain provisioner leases to the watermark:** `drainProvisionerLeases` → `{state:'closed'}`. A stuck (expired-unreleased) lease REFUSES the drain (#3) — resolve explicitly (`resolveStuckProvisionerLease`, attributed), then re-run.
4. **Fresh-generation descriptor repoint:** `rollbackActivationRecord(db, { toGeneration: <target> })` — the COMPLETE prior tuple under generation MAX+1.
5. **Set the epoch doc to the TARGET descriptor's epoch, still closed:** `{state:'closed', epochId: <the restored activeEpochId>}`.
6. **ROLLBACK-A — closed, read-only verification:** the loader returns the restored tuple at the fresh generation (`toGeneration: 1` ⇒ `{activated: true, genesis: true}`, base-only); the descriptor's full 7-field tuple equals the history row's content; a seed-plan RESOLUTION under the restored version equals the restored identity's defaults (a computation — zero writes, the #7 pattern); stale stamps confirmed rejectable by inspection of a persisted projection stamp vs the new generation.
7. **ROLLBACK-B — probe-gated verification-open:** write `{state:'probe', epochId: <restored epoch>, probeIdentities: [<the enumerated operator ids>]}` — **the same mechanically-enforced gate as 8B** (server chokepoint rejects any unlisted/unthreaded actor `probe_only`; the rules layer requires `request.auth.uid` in the list AND the current epoch token — both negative-control-proven). Under the gate: run the **provenance-queried reconciliation** (below), then real probes — a probe birth seeds the restored identity's defaults; a probe compile resolves the restored cell source (record-scoped, #11); a stale-stamped agent rejects at battle creation until redeployed.
8. **Reopen + resume ONLY after Rollback-B passes:** `{state:'open', epochId: <restored epoch>}` (clients re-capture the token on their next formed mutation); resume the external-admin rows (each resume acknowledged); lift the traffic gate.

**The interleaving guarantee (proven row):** a write flow pinned under the pre-rollback world cannot commit after the protocol runs — while closed it rejects at the epoch belt; after the verified reopen it STILL rejects at the descriptor compare (`projection_stale_generation` / `battle_cutover_interleaved`). Reopening never re-admits a pre-rollback flow.

**The battle rule (the #2 question, answered with the PROOF branch):** in-flight battles are NOT drained before the repoint — **locked manifests make them independent**: (a) the prompt surface is structurally banned from every compat/resolver import (the forbidden-reads CI rule + M11 one-hop sweep); (b) the eval path performs no re-projection (battle `agentContext.activeRules` is frozen at creation); (c) the advisory admissibility gate compares the manifest/slice stamp pair WITHIN the battle doc — both halves were stamped atomically by FC-1, so a pre-rollback battle stays internally consistent and renders its own generation's content to completion. New battles for stale-stamped agents reject until redeploy (the reader direction).

**Scope statement (#1/#12 — the claim of record):** through 8A the protocol is TOTAL (no v3 base state exists). During 8B the only v3 base state is the ENUMERATED probe identities — reversed by the **named hand reconciliation**: for each identity found by the provenance query, delete its v3 born-with rule docs + reseed at the restored version (`seedArchetypeTraitsDeterministic`, deterministic ids overwrite), reset its `equippedTraits` to the reseeded set, and force a redeploy (its projection re-derives + restamps at the restored generation). After general unfreeze, the protocol is **selector-total plus that reconciliation applied to every v3-born identity**. **The reconciliation QUERIES the birth-provenance stamps (re-review #6)** — `agents` where `activationGenerationAtBirth >= <the rolled-back-from generation>` (equivalently `identityVersionAtBirth: 3` for this event) — never inference from born-with trait ids; every fresh seed stamps both fields (server paths from their pinned descriptor, the client birth from the record read; clone paths inherit the source's stamps). The honest-divergence regression row (birth-switch suite) records exactly what the repoint does not reverse. **Rollback-to-genesis is claimed for THIS event only** (2 → 1); arbitrary-generation rollback is FILED post-event behind immutable per-revision override snapshots / a frozen final epoch revision (the ledger's filed prerequisite).

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

*(Re-review #9: STRICT order — −1 → 0 → 1 → … → 8A → 8B → 9. If THE ROLLBACK PROTOCOL is invoked at any point, append its own rows (R1–R8, one per protocol step) at the point of invocation — never overwrite a completed step's row.)*

| Step | Started | Result / counts | Verified by | Operator |
|---|---|---|---|---|
| −1 (rules deploy) | | | | |
| 0 (preflight + advisory drain) | | | | |
| 1 (deploy → SHA pin → pause+ack → genesis → close → hard drain gate) | | | | |
| 2 (FINAL-DRYRUN ratification) | | | | |
| 3 (--apply --during-close) | | | | |
| 4 (zero-residual verify) | | | | |
| 5 (candidate pipeline, explicit scope) | | | | |
| 6 (stale-artifact sweep) | | | | |
| 7 (THE FLIP — generation 2) | | | | |
| 8A (closed read-only verification) | | | | |
| 8B (probe-gated verification; probe ids enumerated here) | | | | |
| 9 (docs closeout) | | | | |
| R1–R8 (rollback protocol, if invoked — appended per step) | | | | |
| 1 | | | | |
| 2 (RATIFICATION) | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 (FLIP) | | | | |
| 8 | | | | |
| 9 | | | | |
