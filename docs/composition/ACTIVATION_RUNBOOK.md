# COMPOSITION ACTIVATION RUNBOOK — the script the founder executes live

**Governs:** the `ARCHETYPE_IDENTITY_VERSION` composition event's activation (identity v2 → v3). · **Basis:** Spec V0.9 §8/§10 as amended by the closure sheet §V, `ACTIVATION_PRECONDITIONS.md` (every PR-4 row), and the founder rulings of Aug 6–7, 2026 (Q1 boundaryStateVersion, Q2 A24, Q3 substitution policy, the 7-field descriptor union, the clean rename). · **Posture at merge:** everything below is DEPLOYED INACTIVE — flags dark, no activation record, byte-identical production behavior. Nothing in this document runs at merge; the founder runs it live, step by step, each step with a named VERIFY and a named ROLLBACK point.

**The one rollback mechanism (A29/A45/A49 + the F2 GENESIS ruling; scope per Sol's pre-activation review #1/#12):** atomic repoint of the **prior descriptor** — `rollbackActivationRecord(db, { toGeneration })` repoints the COMPLETE prior tuple from the append-only history under a strictly-greater generation, executed only through **THE ROLLBACK PROTOCOL** (its own section below). **The guarantee, stated honestly:** rollback is **TOTAL while the fleet is frozen** (through step 8A — no v3 base state exists anywhere, so the selector repoint restores the pre-activation world exactly; proven rows). **During 8B** the only v3 base state is the ENUMERABLE operator probe identities — reversed by the named hand reconciliation listed in the protocol. **After general unfreeze,** rollback is **selector-total plus that reconciliation** (base state born under v3 is not reversed by the repoint — the honest-divergence regression row records this). **Rollback-to-genesis is claimed for THIS event only** (generation 2 → 1); an arbitrary-generation rollback claim is FILED post-event behind its prerequisite (immutable per-revision override snapshots / frozen final epoch revision — the ledger's filed item). The catalog holds every version immutably; **nothing is ever "restored"**; the abandoned epoch's overrides silently leave resolution and never resurrect. Before genesis, "rollback" = stop; nothing has changed.

**Standing rules for the window:** **once step 7 has run, `COMPOSITION_EPOCH_FENCE_ENABLED` NEVER lowers** — post-activation it is load-bearing for the server-side descriptor pins (birth-path version selection, projection guard, FC-1 stamping); lowering it splits identity selection instead of deactivating (§2 review F5); deactivation is `rollbackActivationRecord`, nothing else. Also: the §6/§8 freeze holds (no new builds/births/enforced saves); every row of `EXTERNAL_ADMIN_WRITE_PATHS.md` is confirmed paused at the close and resumed at the unfreeze; the A7-LOCK freeze (ACTIVATION_EVIDENCE.json) is in force from step 3 — any movement in a frozen value re-opens the gate chain.

**THE QUIESCE CRITERION (founder ruling, Aug 13 — the criterion of record for what must be paused).** A writer is judged on three axes, **in order**:

1. **STORE** — does it write a protected-store doc at all (`agents`, `rules`/`bundles`, `compiledBuilds`, `composition*`)? No ⇒ done, nothing to do.
2. **FENCE** — is that write epoch-fenced or lease-guarded? Fenced ⇒ it rejects inside the closed window ⇒ done.
3. **ATTRIBUTABILITY** — if unfenced, can a post-watermark write be traced to a NAMED runbook step? Yes ⇒ leave it running. **No ⇒ QUIESCE it.**

**The identity/non-identity field split is NOT the test** (superseding the narrower "unfenced identity writers only" framing, ruled too narrow on Aug 13). **The step-1.11 sweep is DOC-scoped, not field-scoped:** every protected-store doc touched after the watermark must be attributable, so a write of purely non-identity fields (evolution, memory, lessons, stats) to `agents/{id}` fails the gate exactly as an identity write does. This is why R7 quiesced `process-pending-reflections` — a non-identity writer — and why `agent-batch-review` joins it. Apply these three axes, in this order, to any writer discovered mid-window.

**⚠ STANDING WARNING — NEVER pause `agent-evaluate`.** It is the **sole battle-completer**, and step 1.10's drain gate **waits on completions**: pausing it means no battle ever completes, the drain never clears, and the run deadlocks with the epoch already closed. It correctly stays scheduled under the criterion above — its unfenced `agents` writes (`agent-evaluate.js:3929,3967` — the `activeBattleId` pointer clear plus the stats block) are battle completions and so are attributable to step 1.10 by construction, they stop on their own once the fleet drains, and its one identity-derived write (`activeRules` via `decide.js` → `commitActiveRulesProjection`) is FENCED from the 1.1 flip (`compositionGenerationFence.js:93-104`). "Crons stay paused" **never** extends to this one.

---

## Step −1 — Rules deploy IMMEDIATELY after merge (the L1-1 window)

**Run within minutes of the merge deploy** (founder ruling, Aug 7): the client birth path reads `composition/activation` on every agent creation by design (A48 — the record is the only selector; no client flag). Until the merged `firestore.rules` read clause is DEPLOYED, that read is DENIED — writes stay byte-identical (every failure resolves LIVE, time-boxed at 1.5 s), but each birth carries one rejected round trip. **This step closes that window operationally.**

1. **Quiesce the two live protected-store writers that are not runbook steps** (founder rulings, Aug 12 — the casual-clone ruling and R7):
   - `CASUAL_CLONE_CONCURRENCY_ENABLED` → **false, deployed**. It flipped true on Aug 11 (2bd50fc9, PR #739), after the PR-4 merge, so casual-clone births and re-syncs write `agents` + `rules`/`bundles` subcollections continuously in production — the one B2-leased provisioner that would otherwise mint identity state inside the window and land in the step-1.11 watermark sweep unattributed. Flag off is preferred over attributing those births and reconciling them on rollback.
   - **Pause the `process-pending-reflections` cron.** `api/agent/reflect.js` writes `agents/{id}` at four allowlisted sites and calls `consolidateAgentEvolution` (`agentConsolidationApply.js:271,302`) for two more. It carries no epoch guard and is Admin-SDK, so neither the fence nor the rules layer stops it; it is correctly absent from the A46 census (it writes evolution/memory fields, not the identity surface) but the watermark sweep is scoped to protected-store docs, so every reflection write appears there. `reflect.js` has no default export — it is not an HTTP endpoint, and this cron is its only caller, so pausing the cron closes the path completely. "Crons stay paused" is not sufficient here; this one is load-bearing for the sweep's zero-result and is named for that reason.
   - **Pause the `agent-batch-review` cron** (added Aug 13 — the cron-list audit at the Option-A ruling). It is the SAME CLASS as the reflections cron and was missed when that one was named: `api/cron/agent-batch-review.js:351` does `db.collection('agents').doc(lessonTargetId).update({lessons, forgeSuggestions})` inside the auto-debrief block, after a `resolveAttributionAgentId` redirect. No epoch guard, Admin-SDK, evolution-surface fields — correctly outside the A46 census on the same reasoning, and inside the watermark sweep for the same reason. Its `25 20,21 * * 1-5` schedule fires in the same evening band the window occupies, so leaving it live would put unattributed `agents/*` writes in the sweep.

   **PAUSE MECHANISM — entry removal (founder ruling, Aug 13, Option A).** Vercel crons are declared in `vercel.json` and registered from the production deployment; there is no per-cron dashboard pause. Both entries are therefore **REMOVED from `vercel.json` for the duration of the window** and restored at step 9. The handlers stay in the tree, unscheduled — the `season-*` precedent in BUILD_RULES §6, including its warning that a handler's header comment is not evidence it runs. De-registration takes effect when this commit's deployment is promoted to production; an invocation already dispatched runs to completion, which is what step 1.3's old-deployment drain bounds. **Restore these two entries VERBATIM at step 9** (cron budget returns 35 → 37):

   ```json
   { "path": "/api/cron/process-pending-reflections", "schedule": "*/15 13,14,15,16,17,18,19,20,21,22,23,0 * * *" },
   { "path": "/api/cron/agent-batch-review",          "schedule": "25 20,21 * * 1-5" }
   ```

   **NOT removed, and why — the full cron classification (Aug 13; recorded so the next reader does not re-derive it).** All 37 entries were classified against THE QUIESCE CRITERION (store → fence → attributability; stated in the standing rules above, and derived from this audit). **No unfenced writer of the IDENTITY surface is invoked from any cron** — the two apparent ones are import-reach only (`writeCompiledBuildsInTx`'s 11 call sites are all fenced endpoints; `seedArchetypeTraitsDeterministic`'s only caller is the B2 lease-guarded `trainingClone.js:231`, and no cron invokes `provisionTrainingClones` or `ensureCasualClone`). The two removed above are unfenced writers of NON-identity fields on `agents` docs, which the step-1.11 sweep catches anyway because **the sweep is doc-scoped, not field-scoped** — that is the R7 reasoning, applied consistently. The rest stay scheduled:

   - **`agent-evaluate` MUST stay scheduled — pausing it DEADLOCKS step 1.10.** It is the only writer that *completes* battles, and the drain gate waits for battles to complete. Its unfenced `agents` writes (`:3929`, `:3967` — `activeBattleId` clear plus the stats block) are battle completions, so they are attributable to step 1.10 by construction, and they stop on their own once the fleet drains. Its one identity-derived write, `activeRules` via `decide.js` → `commitActiveRulesProjection`, is FENCED from the 1.1 flag flip (`compositionGenerationFence.js:93-104` — `validateWriteEpochInTx` plus the descriptor compare that rejects a generation N−1 derivation).
   - **`live-draft-fire`, `tournament-orchestrator`, `snake-draft-daily-scores`** reach `ensureCpuAgents` (`tournamentCpu.js:111`), which creates `agents/cpu-*` docs. This is **census class F — already adjudicated as carrying no identity content** ("no rules subcollection, `activeRules:[]`", PR2_RESOLVER_AND_EPOCH_DESIGN §3), so it is not an activation-correctness risk and needs no fence. It is a lazy get-or-create, so it writes **only if a group forms or advances inside the window**; if one does, attribute the resulting `agents/cpu-*` creations to normal tournament operation in the 1.11 sweep.
   - **`agent-daily-scores`, `voice-layer-cache`** reach `compileOnSettingsChange.js:398` by import only — no cron invokes it.
   - **The remaining 29 entries write no protected store at all.** 28 never name one anywhere in their import closure; `process-draft-claims`'s single mention is `src/constants/leagueTournament.js`, a constants file with no write calls.

2. **Deploy `firestore.rules`; fetch the DEPLOYED text; run the emulator smoke against it; fill `docs/composition/RULES_DEPLOY_RECORD.json`; `node scripts/composition/check-rules-deploy-gate.js` must PASS** (the B9 gate — it runs HERE now; step 1 re-verifies it). The command below is the corrected form — `npm run test:rules -- <spec>` appends the spec to `firebase emulators:exec`, not to vitest, and exits 1 with no output (R2):

   ```bash
   COMPOSITION_RULES_TEXT_PATH=<fetched> npx firebase emulators:exec --only firestore \
     --project demo-tradeseven-rules \
     "npx vitest run --config vitest.rules.config.mjs test/rules/compositionEpochDenials.rules.mjs"
   ```

**VERIFY:** `CASUAL_CLONE_CONCURRENCY_ENABLED=false` in the DEPLOYED build — fetch the production `index.html`, follow its `/assets/index-*.js`, and confirm the literal `ensure-casual-clone` is **absent** (the flag block at `agentDeploy.js:39` is dead-code-eliminated when the flag is false) while `api/agent/decide` — the sibling fetch in the same function — is **present** as the positive control. Absence-with-control is the proof; a bare 403 probe is NOT reachable, since `requireAuth` (`ensure-casual-clone.js:43`) returns 401 before the flag check at `:48` (R8). `process-pending-reflections` confirmed paused. B9 gate PASS; a client read of `composition/activation` while signed in returns not-found (allowed, record absent) instead of permission-denied. **ROLLBACK POINT:** nothing else changed — stop is free.

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
6. **Open the epoch EXPLICITLY:** **`transitionWriteEpoch(db, { state: 'open', epochId: '<E0, new>' })`** ⇒ `{state:'open', epochId:E0, fenceGeneration:1}` — today's implicit fail-open world made explicit, at **incarnation 1** (BL1: every epoch-state write goes through the helper, which computes `fenceGeneration` mechanically — a quiesced world becoming writable increments it; closes retain it; clients and server transactions pin the {epochId, fenceGeneration} TUPLE, so no later incarnation can re-admit an earlier incarnation's mutation). Required now: the genesis write arms B1, and the armed world must never see an absent epoch doc.
7. **Deployed-lambda snapshot smoke (#9 — BEFORE genesis):** invoke a REAL deployed path that resolves **v2 via the bundled historical snapshot** AND **v3 via the catalog** (the F7 `includeFiles` verification made concrete — e.g. an internal-caller probe of the version-parameterized resolver at both versions). **Record BOTH identity hashes** in the log; they must equal the catalog-lock values. **Failure ⇒ do NOT write genesis** — stop, fix the bundling, redeploy, restart from 1.1.
8. **GENESIS (the F2 ruling — BEFORE the epoch close, paired with the open epoch doc):** **`writeGenesisDescriptor(db, { activeEpochId: '<E0>' })`** — generation 1 = the genesis descriptor `{activeIdentityVersion: 2 (live), boundaryStateVersion: 1, candidateStateId: 'genesis', semanticHash: <the reserved null-sentinel>, activeEpochId: E0, overrideRevision: 0}`. No overlay participation — the loader short-circuits to base-only; births, reads, and compiles are UNCHANGED (proven rows incl. the genesis-present pipeline row). The write validates the open epoch pairing in its own transaction and refuses if any record exists. **From this write on: B1's absent-epoch-doc-fails-closed is armed coherently, and a prior descriptor exists for every future generation.**
9. **Close the epoch:** `transitionWriteEpoch(db, { state: 'closing', epochId: 'E0' })` (the incarnation RETAINS — 1) → new writes + lease acquisitions reject → **drain provisioner leases** (`drainProvisionerLeases`; B2). **A lease that expires without release does NOT drain (#3):** the drain REFUSES and names the holder — verify the holder process is dead (the max-function-lifetime bound of 1.3), then `resolveStuckProvisionerLease(db, leaseId, { operator, reason })` (attributed in the log), and re-run the drain. Then `transitionWriteEpoch(db, { state: 'closed', epochId: 'E0' })` — **the watermark** (still incarnation 1). (The epoch doc is UPDATED, never deleted — post-genesis an absent doc fails closed everywhere.)
10. **Battle-drain HARD GATE (#7 — the post-watermark repeat of A26/A35):** re-run the step-0.3 predicate over active `agentBattles` NOW, after the watermark. **This result — not step 0's — is the gate:** any battle matching the predicate ⇒ wait for it to complete before step 2. Record the post-watermark count (expected 0). **`agent-evaluate` MUST be running for this gate to clear** — it is the sole battle-completer, so pausing it deadlocks this step (see the standing warning above).
11. **Watermark sweep (B8):** every protected-store doc updated after the watermark must be attributable to a named runbook step.

**VERIFY:** preflight green at the activation SHA; both snapshot-smoke hashes recorded and catalog-equal; B9 gate PASS; the loader returns `{activated: true, genesis: true, generation: 1}` and — **the NON-WRITING birth check (re-review #7)** — the seed plan RESOLVED under the genesis-selected version (`selectIdentityVersion` → `buildSeedPlan`) equals the live defaults, a pure computation with zero writes (the fleet is closing/closed here; the behavioral proof is the birth-parity suite row, re-executed as a resolution, not a write); drain result `{drained:true}` with zero unresolved stuck leases; post-watermark battle predicate = 0; fence suite semantics live (a probe write 409s `epoch_closed`). **ROLLBACK POINT:** reopen via **`transitionWriteEpoch(db, { state: 'open', epochId: 'E0' })`** — NEVER a raw doc write (Sol's final blocker: a raw reopen would resurrect the incarnation ABA batch 12 removed) — then **VERIFY AND LOG the returned `fenceGeneration: 2`** (closed→reopen of the same epoch mints the next incarnation; every pre-close client token and server pin died with incarnation 1). Resume the paused rows (each resume acknowledged) — genesis stays: it is generation 1 forever, selects the live identity, and changes no behavior.

## Step 2 — FINAL-DRYRUN (hard gate; founder ratifies the exact counts)

Run **`node scripts/composition/migration-scan.js`** (dry-run) at the deployed SHA against the closed fleet. The report carries `activeIdentityVersion: 3`, the affected-agent/entry/report-class counts, `semanticHash`, `runHash`.

**HARD GATE:** the founder records ratification of the EXACT counts (this file's log, below) — required because A11 moved the migration population (the six former needsBinding rows now clamp) and the item-6 substitutions (incl. the two beyond-item-6 hosts, if ratified) change the DEFAULT_TRAITS surface. `--apply` refuses without this ratification. **The A7-LOCK freeze is in force from here.**

**VERIFY:** two consecutive dry-runs agree on `semanticHash` (M12 — the runId-independent identity). **ROLLBACK POINT:** reopen the epoch via `transitionWriteEpoch` (the step-1 rollback point, incl. its fenceGeneration verify+log); no state written.

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

**Open for probes — MECHANICALLY GATED (re-review #4):** **`transitionWriteEpoch(db, { state: 'probe', epochId: '<E1, the step-7 epoch>', probeIdentities: [<the enumerated operator uids>] })`** ⇒ `{state:'probe', epochId:E1, fenceGeneration:2}` (BL1: the closed world becomes probe-writable — a NEW incarnation; every step-1-era client token died with incarnation 1) (UPDATE, never delete: post-genesis an absent doc fails closed at every boundary incl. the provisioner lease). The gate is CODE-ENFORCED, not operational assertion: the server chokepoint (`validateWriteEpochInTx` + the provisioner-lease acquisition) rejects any actor not in `probeIdentities` — and any writer that doesn't thread an actor at all — with `probe_only` (negative-control row: probe state + non-probe identity ⇒ 409, zero writes); the rules layer denies any client-SDK identity write whose `request.auth.uid` is not listed or whose epoch token is stale (emulator rows). The §6 freeze stays announced, every EXTERNAL_ADMIN_WRITE_PATHS row stays paused, crons stay paused — but none of that is what holds the door: **the probe state does.**

**Probe checks (the §10 positive/negative set that needs writes — each observed, not assumed):**
- a probe birth seeds the SUBSTITUTED defaults (guardian: `alloc-sector-cap`; the record selected them — A24);
- a probe deploy + battle: the new battle's manifest carries the FC-1 stamps (`compositionSourceGeneration` = 2, slice stamp equal); a trait-hosted tension renders its advisory exactly once in the live prompt;
- `core_conflict` **absent** from a live prompt (probe-equip a banned pairing via the client SDK; compile blocks it; the prompt renders nothing for it);
- `deferred` **absent** the same way;
- **out-of-domain save rejected BY THE VALIDATOR through the freeze-passing path**: a probe save carrying an out-of-domain param 409s from `checkCandidatePairing` at the endpoint (the A7 kernel — not the freeze, not the fence);
- **stale-build rejection observed (write side)**: a pre-flip build recompiles at current revision — never serves;
- **M7 live measurement:** one probe eval request's `usage.input_tokens` + one draft request's recorded against the M7-E2E budgets.

**8B FAILURE ⇒ THE ROLLBACK PROTOCOL** (below). The only v3 base state at that point is the enumerated probes' — reversed by the protocol's named hand reconciliation.

**General unfreeze (ONLY after every 8B check passes):** `transitionWriteEpoch(db, { state: 'open', epochId: 'E1' })` — probe→open RETAINS the incarnation (2; no intervening close, BL1) and removing the probe gate is what opens general traffic (clients capture the {epochId, fenceGeneration} tuple on their next formed mutation); lift the §6 freeze announcement; resume the EXTERNAL_ADMIN_WRITE_PATHS rows (each resume acknowledged); `COMPOSITION_MIGRATION_FEED_ENABLED` flips only after the record is verified (A44, flag-ownership table); purge the lease registry (`purgeReleasedProvisionerLeases` — released-only, #3/F9).

**VERIFY:** every probe check recorded with its observation + the probe-identity enumeration. **ROLLBACK:** THE ROLLBACK PROTOCOL, any time — scope per its statement.

## THE ROLLBACK PROTOCOL (Sol pre-activation review #2 — symmetric with activation; the ONLY way a rollback runs)

A bare `rollbackActivationRecord` call is never executed alone. The protocol, in order *(re-review #2: the pause-and-acknowledge discipline is IMPLEMENTED in the numbered order — before any epoch-state write; re-review #3: verification splits Rollback-A / Rollback-B, mirroring 8A/8B on the same probe-gate mechanism)*:

1. **Pause external admin FIRST:** every EXTERNAL_ADMIN_WRITE_PATHS row paused + positively acknowledged (per-row sign-off: operator, timestamp, mechanism). No epoch-state write may precede the last acknowledgment.
2. **Close the current epoch:** `transitionWriteEpoch(db, { state: 'closing', epochId: '<current>' })` — new writes and lease acquisitions reject from this write on (the incarnation retains through the close).
3. **Drain provisioner leases to the watermark:** `drainProvisionerLeases` → `transitionWriteEpoch(db, { state: 'closed', epochId: '<current>' })`. A stuck (expired-unreleased) lease REFUSES the drain (#3) — resolve explicitly (`resolveStuckProvisionerLease`, attributed), then re-run.
4. **Fresh-generation descriptor repoint:** `rollbackActivationRecord(db, { toGeneration: <target> })` — the COMPLETE prior tuple under generation MAX+1.
5. **Set the epoch doc to the TARGET descriptor's epoch, still closed:** `transitionWriteEpoch(db, { state: 'closed', epochId: '<the restored activeEpochId>' })` (closed→closed: the incarnation still retains — the NEW incarnation mints at the reopen, never before).
6. **ROLLBACK-A — closed, read-only verification:** the loader returns the restored tuple at the fresh generation (`toGeneration: 1` ⇒ `{activated: true, genesis: true}`, base-only); the descriptor's full 7-field tuple equals the history row's content; a seed-plan RESOLUTION under the restored version equals the restored identity's defaults (a computation — zero writes, the #7 pattern); stale stamps confirmed rejectable by inspection of a persisted projection stamp vs the new generation.
7. **ROLLBACK-B — probe-gated verification-open:** **`transitionWriteEpoch(db, { state: 'probe', epochId: '<restored epoch>', probeIdentities: [<the enumerated operator ids>] })`** — the closed world becomes probe-writable: a **NEW incarnation** (BL1's regression rows (a)/(b) are exactly this seam: a client token or server pin formed under the restored epoch's EARLIER incarnation is DENIED — same epoch id, different fenceGeneration). **The same mechanically-enforced gate as 8B** (server chokepoint rejects any unlisted/unthreaded actor `probe_only`; the rules layer requires `request.auth.uid` in the list AND the current tuple — both negative-control-proven). Under the gate: run the **provenance-queried reconciliation** (below) — **the ONLY intentional admin-write exception while Rollback-B is active** (Sol's major): before it runs, record its TARGET COUNT in the log (the result count of the provenance query `activationGenerationAtBirth >= <rolled-from generation>`), and every write it performs must be attributable to exactly that enumerated set — any other admin write during the window is a defect. Then real probes — a probe birth seeds the restored identity's defaults; a probe compile resolves the restored cell source (record-scoped, #11); a stale-stamped agent rejects at battle creation until redeployed.
8. **Reopen + resume ONLY after Rollback-B passes:** `transitionWriteEpoch(db, { state: 'open', epochId: '<restored epoch>' })` — probe→open retains the Rollback-B incarnation (clients re-capture the tuple on their next formed mutation); resume the external-admin rows (each resume acknowledged); lift the traffic gate.

**The interleaving guarantee (proven row):** a write flow pinned under the pre-rollback world cannot commit after the protocol runs — while closed it rejects at the epoch belt; after the verified reopen it STILL rejects at the descriptor compare (`projection_stale_generation` / `battle_cutover_interleaved`). Reopening never re-admits a pre-rollback flow.

**The battle rule (the #2 question, answered with the PROOF branch):** in-flight battles are NOT drained before the repoint — **locked manifests make them independent**: (a) the prompt surface is structurally banned from every compat/resolver import (the forbidden-reads CI rule + M11 one-hop sweep); (b) the eval path performs no re-projection (battle `agentContext.activeRules` is frozen at creation); (c) the advisory admissibility gate compares the manifest/slice stamp pair WITHIN the battle doc — both halves were stamped atomically by FC-1, so a pre-rollback battle stays internally consistent and renders its own generation's content to completion. New battles for stale-stamped agents reject until redeploy (the reader direction).

**Scope statement (#1/#12 — the claim of record):** through 8A the protocol is TOTAL (no v3 base state exists). During 8B the only v3 base state is the ENUMERATED probe identities — reversed by the **named hand reconciliation**: for each identity found by the provenance query, delete its v3 born-with rule docs + reseed at the restored version (`seedArchetypeTraitsDeterministic`, deterministic ids overwrite), reset its `equippedTraits` to the reseeded set, and force a redeploy (its projection re-derives + restamps at the restored generation). After general unfreeze, the protocol is **selector-total plus that reconciliation applied to every v3-born identity**. **The reconciliation QUERIES the birth-provenance stamps (re-review #6, semantics per the batch-12 BL2 split)** — `agents` where `activationGenerationAtBirth >= <the rolled-back-from generation>` (equivalently `identityVersionAtBirth: 3` for this event) — never inference from born-with trait ids. **Every fresh identity — including a NEWLY CREATED clone — stamps its own CURRENT birth descriptor** (server paths from their pinned descriptor, the client birth from the record read, both casual/training clone creations from their own pin); **loadout lineage lives separately** in `loadoutSourceIdentityVersion` / `loadoutSourceActivationGeneration` (the source's birth stamp, refreshed on re-sync); **a re-sync preserves the existing clone's birth stamp** (only an actual new birth stamps fresh), so the query dates every object by its true creation, clone or not. The honest-divergence regression row (birth-switch suite) records exactly what the repoint does not reverse. **Rollback-to-genesis is claimed for THIS event only** (2 → 1); arbitrary-generation rollback is FILED post-event behind immutable per-revision override snapshots / a frozen final epoch revision (the ledger's filed prerequisite).

## Step 9 — PR 5 docs closeout

The `--apply` report, zero-residual output, preflight reports, watermark sweep, the filled RULES_DEPLOY_RECORD, the §10 observations, and this log → `docs/audits/` in a docs-only PR 5. The ledger's PR-4 rows move to CLOSED with their observations cited.

**LAST — one restoration commit, deployed** (founder rulings, Aug 12 and Aug 13). This runs after the general unfreeze of 8B, and after every other step-9 item: it is the only deliberate re-widening of the identity-write surface in this event, so it lands last and is logged with its own operator + timestamp row. It restores, in one commit:

- `CASUAL_CLONE_CONCURRENCY_ENABLED` → **true**;
- the two `vercel.json` cron entries removed at step −1 (`process-pending-reflections`, `agent-batch-review`) — **verbatim, from the JSON block recorded in step −1**; cron budget returns 35 → 37.

**Why the crons resume HERE and not at the 8B general unfreeze:** entry removal is a deploy-time mechanism, so restoring them is a commit, and step 1.2 forbids any commit or deploy from the ACTIVATION SHA pin onward. Everything else paused for the window — the `EXTERNAL_ADMIN_WRITE_PATHS` rows, the crons whose entries were never removed — still resumes at the 8B unfreeze; these two cannot, because their pause was structural rather than operational. Verify after deploy: both paths appear in the Vercel project's cron list, and `grep -c '"path"' vercel.json` returns 37.

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

**MERGE FREEZE — declared 2026-08-12 22:57 -0500 (founder).** No merges to `main` until activation completes or the founder lifts it. Rationale: `main` took two feature merges (PR #750 Mandate Phase 3 at 21:04:27, PR #751 flag-off at 21:34:57) inside the pre-flight window, each re-opening the step-0 preflight and one of them changing `firestore.rules`. Step 1.2 pins THE ACTIVATION SHA and forbids any later commit; the freeze is what makes that pin hold. **Freeze SHA: the `main` tip at the moment step 1.2 runs — recorded in the step 1.2 log row, not here.** A document cannot hold a correct hash of itself: every merge taken under a freeze exception moves the tip, including the merge that writes this line, so any value printed here is stale on arrival. The pin of record is written once, into the log row, at the moment it is taken. **Pre-pin reference:** `7fe8c34edab454dac1e81008d40981dfef7e98d4` — the tip this note was last written against, for provenance only; it is NOT the pin. Lift is a logged act with its own timestamp + operator.

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
