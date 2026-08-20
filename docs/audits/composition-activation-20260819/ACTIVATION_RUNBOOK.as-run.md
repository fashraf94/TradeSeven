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

   **PAUSE MECHANISM — entry removal (founder ruling, Aug 13, Option A).** Vercel crons are declared in `vercel.json` and registered from the production deployment; there is no per-cron dashboard pause. Both entries are therefore **REMOVED from `vercel.json` for the duration of the window** and restored at step 9. The handlers stay in the tree, unscheduled — the `season-*` precedent in BUILD_RULES §6, including its warning that a handler's header comment is not evidence it runs. De-registration takes effect when this commit's deployment is promoted to production; an invocation already dispatched runs to completion, which is what step 1.3's old-deployment drain bounds. **Restore these two entries VERBATIM at step 9** (cron budget returns **37 → 39** — corrected 2026-08-15; see the step-9 note, and BUILD_RULES §6's assumed Pro ceiling of 40):

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

1. Confirm the Vercel production deployment SHA == the merged PR-4 SHA. Record both in the log below. **⚠ The PR-4 constant is SUPERSEDED — see the 0.1 amendment below; record the row in the amended form, not this one.**

   **0.1 — deployed-SHA confirmation (PR-4 constant SUPERSEDED, founder ruling 2026-08-15).** The runbook's literal test, *"deployment SHA == the merged PR-4 SHA,"* is retired as a constant and preserved as an invariant. PR-4 is `08e5853e` (#728, merged 2026-08-08 16:49 −05); `main` has since taken 37 merges / 94 commits, so the literal equality could hold only by rolling production back seven days — the opposite of the clause's intent. The SHA was written when PR-4's merge *was* the tip; **the invariant it stands for is `deployed artifact == the SHA the step-0.2 preflight is run against`, and that is what 0.1 now records.** Test of record: **deployed production SHA == `main` tip at this moment**, both recorded here. Coverage of the intervening merges is **not asserted by this row** — it is established by 0.2's own run, which re-derives the A46 census, the B3/B3-EXT deny-by-default scan and the batteries from the tree at the given SHA rather than from a diff, so a single green run at the deployed SHA covers all 37 by construction. A row recording equality without a green 0.2 beneath it proves nothing. **Provisional by design:** step 1.2 re-pins THE ACTIVATION SHA at the final deployed SHA after the flip commits, and that pin — not this one — is what the freeze protects.

   **0.1 RECORDED — 2026-08-15 22:02 −05.** · Deployed SHA: `1dff1fa0f9dd0322d26ee028a83762faef755124` · `main` tip: `1dff1fa0f9dd0322d26ee028a83762faef755124` · Equal: **yes**

   *Evidence for the deployed value (recorded because it was not trivially readable).* Production is `dpl_CzV4Y6WefAwYG1Ukb1ooNu5LE7SQ`, created 2026-08-15 18:28:12 −05, holding the apex aliases `fantasytrades.io` / `www.fantasytrades.io` — i.e. it is the deployment actually serving, not merely the newest Ready one. Its SHA is taken from **the deployment's own build log**: `Cloning github.com/fashraf94/TradeSeven (Branch: main, Commit: 1dff1fa)` at `2026-08-15T23:28:13.588Z`. The `vercel inspect --json` payload in the installed CLI carries no `meta`/`gitSource`, so the commit field is not readable there; the build log is the authoritative substitute and is quoted rather than paraphrased. `main` tip read after `git fetch origin`, working tree clean, local `main` == `origin/main`.

   **The row is backed by a green 0.2 beneath it, as the amendment requires** — `preflight-at-sha.js --sha 1dff1fa0f9dd0322d26ee028a83762faef755124`, exit 0, verdict `PASS`, **5/5 suites `green`**, report `scripts/composition/out/preflight-1dff1fa0f9dd.json` (`ranAt` 2026-08-16T03:02:48.275Z, `treeClean: true`). This is the FIRST authoritative 0.2 of the run: every prior attempt returned `did-not-run` on the win32 spawn defect fixed in #768 (`24172545`), which is itself the tip this row pins. **No newly-discovered writer** — the A46 census suite is green, so the PR #716 casualClone reconciliation branch is not entered. Coverage of the intervening merges rides on this run re-deriving census/scan/batteries from the tree at this SHA, per the amendment's own reasoning.
   **0.1 + 0.2 RE-RECORDED — 2026-08-19 16:47 −05, at `7c70ae6b`. The 08-15 rows above STAND as written and are NOT superseded in content — they are simply no longer the current row, because `main` moved.** Step 0 was re-opened by the second freeze crossing (nine unlogged merges; see the run-log entry of this date), on the re-assertion's own terms: *"Any further crossing re-opens step 0."* · **Deployed SHA: `7c70ae6be6373bed6bbaaa3e0a345161cc5ae477`** · **`main` tip: `7c70ae6be6373bed6bbaaa3e0a345161cc5ae477`** · **Equal: yes.**

   *Evidence for the deployed value (same method as the 08-15 row — the CLI's `inspect --json` still carries no `meta`/`gitSource`, so the build log is quoted rather than paraphrased).* Production is `dpl_8Wu7gHcxw5cZ6HDJENqe63fCM2vh`, created 2026-08-19 15:09:38 −05, holding the apex aliases `fantasytrades.io` / `www.fantasytrades.io` — the deployment actually serving, not merely the newest Ready one. Its SHA is read from the deployment's own build log: `Cloning github.com/fashraf94/TradeSeven (Branch: main, Commit: 7c70ae6)` at `2026-08-19T20:09:39.497Z`. `main` tip read after `git fetch origin`; working tree clean; local `main` == `origin/main`. Both values re-confirmed unchanged at 16:47 −05, after the suites finished, so the row is not stale on arrival.

   **The row is backed by a green 0.2 beneath it, as the amendment requires** — `preflight-at-sha.js --sha 7c70ae6be6373bed6bbaaa3e0a345161cc5ae477`, **harness exit 0, verdict `PASS`, 5/5 suites `green`**, report `scripts/composition/out/preflight-7c70ae6be637.json` (`ranAt` 2026-08-19T21:45:04.720Z, `treeClean: true`). Per-suite, with the runner status the harness actually recorded (it writes `green` only for spawn status 0; a non-zero status renders as `exit <n>` and a spawn failure as `did-not-run`, so `green` IS the real exit code):

   | Suite | Spec | Result | Rows |
   |---|---|---|---|
   | `compositionWriterCensus` | `api/_utils/compositionWriterCensus.test.js` | **green** (0) | 6 |
   | `compositionProtectedStores.scan` | `api/_utils/compositionProtectedStores.scan.test.js` | **green** (0) | 9 |
   | composition battery | `api/_utils/composition*` | **green** (0) | 205 across 18 files |
   | fence behavior | `api/agent/composition.fenceBehavior.test.js` | **green** (0) | 45 |
   | candidate registry + default traits | `archetypeCompatibilityCandidate` + `archetypeDefaultTraits.composition` | **green** (0) | 20 |

   **No newly-discovered writer** — the A46 census suite is green, so the PR #716 casualClone reconciliation branch is not entered. **This is the row that matters for the crossing:** `api/cron/agent-evaluate.js` moved **+425 / −6** across four commits in the unlogged window, and it is the sole battle-completer step 1.10's hard gate waits on; `api/_utils/compileBuild.js` (+42 / −15) and `api/_utils/shadowAssemblyCapture.js` (+5 / −1) moved too, both on the step-5 candidate path. Coverage of all of it rides on this run re-deriving census, scan and batteries **from the tree at this SHA** rather than from a diff — the amendment's own reasoning, and the reason a green run at the deployed SHA covers the window by construction. **`METRIC_HISTORY_SNAPSHOT_ENABLED` (flipped true 08-19, `d33f898c`) was assessed against THE QUIESCE CRITERION before this row was written:** `metricSnapshots.js` writes `metricSnapshots/{ticker}/daily/{asOfDate}` (`:127`) and `quarterlySeries/{ticker}` (`:188`) — **axis 1 (STORE) answers no**, so no quiesce action is required and the step-1.11 sweep is unaffected, the same disposition #763/#764 received. Its two `unresolved` deny-by-default allowlist entries (added in `d9768ec6`) carry no `_notes_` block naming their verified target, unlike every comparable entry; the targets are recorded here instead, and the note is filed as a docs gap in the ratchet, not an activation-correctness defect.

   **MANUAL GATE (F5), signed here because the harness prints it and cannot check it:** `composition/activation` does **not** exist in production (observed this session — see the 0.3 row's dark-state note), so the "flag must never be false while a record exists" condition is not yet live. `COMPOSITION_EPOCH_FENCE_ENABLED` is nevertheless **true** in the deployed build (`compositionConfig.js:43` at `7c70ae6b`), which is the safe side of that gate.
2. Run **`node scripts/composition/preflight-at-sha.js --sha <deployed-sha>`** (B8-FINAL). It refuses on HEAD mismatch or a dirty tree and re-runs: the A46 writer census, the B3/B3-EXT deny-by-default scan, the composition battery, the fence-behavior suite, the candidate registry + default-trait suites. **Any newly-discovered writer is reconciled BEFORE proceeding** (the PR #716 casualClone precedent).
3. **Drain gate (A26/A35) — ADVISORY here (Sol review #7):** no active battle's birth identity may differ from the candidate boundary. Predicate over active `agentBattles`: `resolvedAgentManifest.versionStamps.identityVersionAtLock < ARCHETYPE_IDENTITY_VERSION` **or** `identityHashAtLock != <live registry hash>` ⇒ wait for those battles to complete (battles run ≤ a day). Record the drained count. This early run is a scheduling aid — **the HARD gate is the post-watermark repeat at step 1.10**, because battles can start between this check and the close.

   **0.3 RECORDED — 2026-08-15 22:07 −05, re-run at the 0.1/0.2 SHA `1dff1fa0` so the count is fresh beneath the recorded row (supersedes the earlier advisory run taken at a different tip).** · **drainCount = 0.** Live values at the read: `ARCHETYPE_IDENTITY_VERSION = 2`, `registryIdentityHash() = 4b44df0be60866bc042fb4adce99281878256f13d74ae0ec02924ee4778d731e`. · **The zero is non-vacuous:** the query read all **348** `agentBattles` docs and histogrammed `status` before filtering — **348 `completed`, 0 `active`, no doc missing the field** — so "0 matches" is a real drained fleet, not a misnamed field or a silently-empty query. Zero active battles ⇒ the predicate has nothing to match on either arm. Read-only; the query script lives outside the repo tree per BUILD_RULES §3.

   **0.3 RE-RECORDED — 2026-08-19 16:46 −05, at the 0.1/0.2 SHA `7c70ae6b`, so the count is fresh beneath the re-recorded row. The 08-15 row above stands; this one is the current count.** · **drainCount = 0.** Live values at the read: `ARCHETYPE_IDENTITY_VERSION = 2`, `registryIdentityHash() = 4b44df0be60866bc042fb4adce99281878256f13d74ae0ec02924ee4778d731e` — **identical to the 08-15 read, which is the correct result and was checked rather than assumed:** the registry has not moved (identity is still v2; nothing has activated), so an unchanged hash is the expected value, not a stale read. · **The zero is non-vacuous, on the same standard as the 08-15 row:** the query read all **360** `agentBattles` docs and histogrammed `status` before filtering — **360 `completed`, 0 `active`, 0 docs missing the field** — and the population itself moved **348 → 360** over the week, which is independent evidence the read is live rather than frozen. Zero active battles ⇒ the predicate has nothing to match on either arm; a stamp-presence census over the active set was also run (0 unjudgeable) so an absent-stamp battle could not hide inside the zero. Read-only; the query script lives outside the repo tree per BUILD_RULES §3.

   **Dark state OBSERVED at this SHA, not carried from memory** (read-only Admin probe, project `tradeseven`, `2026-08-19T21:32:01Z`): `composition/activation` **absent**, `composition/writeEpoch` **absent**, `listDocuments()` over `composition` **0**, over `compositionCandidateState` **0**, and `composition/activation/compositionActivationHistory` **0** — no generation was ever written. `listDocuments()` enumerates phantom parents of subcollections too, so the zeros are the strong form. The two step-1.1 flips are live in the deployed build (`COMPOSITION_EPOCH_FENCE_ENABLED`, `COMPOSITION_COMPILED_IDENTITY_ENABLED` — both `true` at `7c70ae6b`) while `COMPOSITION_ENFORCEMENT_MODE 'off'`, `COMPOSITION_MIGRATION_FEED_ENABLED false`, `COMPOSITION_DISPLAY_ENABLED false` and `CASUAL_CLONE_CONCURRENCY_ENABLED false` all remain dark. Step −1's bundle probe was re-run against today's artifact and still holds: `ensure-casual-clone` **absent** from `/assets/index-DiLGDcXU.js`, positive control `api/agent/decide` **present**. *Honest limit:* both flip flags are server-side and behavior-neutral pre-close by design (the fence fail-opens on an absent epoch doc; the candidate boundary follows THE RECORD, not the flag), so no runtime probe can distinguish them — the claim rests on deployed-SHA identity plus source at that SHA, the same basis 0.1 adopts.

   **THE LEASE REGISTRY IS EMPTY, NOT DRAINED — a fact about the evidence, not a defect (recorded 2026-08-19 at the founder's instruction).** `node scripts/composition/lease-ops.js list` against production returns **0 active, 0 STUCK** (`scripts/composition/out/lease-ops-list-2026-08-19T21-33-27-729Z.json`), and a direct read of `compositionProvisionerLeases` returns **0 documents total** — 0 released, 0 unreleased. The list reads the whole collection unfiltered (`compositionProvisionerLease.js:161-172`), so the zero is the real population. It is empty rather than drained because `acquireProvisionerLease` returns `{dark: true}` with zero reads while `COMPOSITION_EPOCH_FENCE_ENABLED` is false (`:88`), and that flag only went live with the 1.1 deploy on 08-16; since then the two holders are `casualClone.js:168` — dead, its flag is false since step −1 — and `trainingClone.js:247`, which no cron invokes. **Consequence for step 1.9, stated plainly so the operator is not surprised:** no stuck lease will refuse the drain, but the drain will also have **no live population to prove itself against** — a `{drained: true}` there is a true result over an empty registry, and it is NOT behavioural evidence that the drain works. That evidence lives where it was built: `api/_utils/compositionLeaseOps.test.js`'s closed-epoch block. The three 08-17 artifacts in `scripts/composition/out/` were all `applied: false` dry runs, so nothing was ever purged.

**VERIFY:** preflight report green (`validatePreflightReport` at the pinned SHA); drain query returns zero. **ROLLBACK POINT:** nothing changed — stop is free.

## Step 1 — Deploy the flip commits, pin the ACTIVATION SHA, write GENESIS, close the write epoch

*(Ordering per Sol's pre-activation review #8/#4/#9: deploy FIRST → preflight at the final deployed SHA → drain old invocations → pause admin BEFORE any epoch-state write → snapshot smoke BEFORE genesis.)*

1. **Deploy the flip commits FIRST** (`COMPOSITION_EPOCH_FENCE_ENABLED=true`, and `COMPOSITION_COMPILED_IDENTITY_ENABLED=true` for the candidate pipeline steps below — flip commits reconciling their own pins, §2 flip rule) and **WAIT for the deployment to be live**. Behavior stays byte-identical — the fence fail-opens pre-close; the candidate boundary follows THE RECORD (#11: `resolveCandidateModeInTx` — no record / genesis ⇒ live cells; the flag is only the dark switch).
2. **Re-run the COMPLETE step-0 preflight at the final deployed SHA** (`preflight-at-sha.js --sha <deployed>`), then **record that SHA as THE ACTIVATION SHA** in the log. **No further commits or deploys after this point** — any commit re-opens step 1 from 1.1.
   **1.2 RECORDED — 2026-08-19 17:13 −05. THE ACTIVATION SHA IS PINNED.**

   > **⚠ THIS ROW IS DELIBERATELY UNCOMMITTED — it is not lost.** Founder ruling, 2026-08-19: recording a runbook row is itself a commit, and this very step forbids any commit or deploy from the pin forward — so committing (and therefore merging and deploying) the row would void the pin the row exists to record. **Every row from 1.2 through 1.11 accumulates in the WORKING TREE only**, and they travel to `docs/audits/` in the step-9 PR 5 closeout, which is where this runbook already sends the log. A byte-exact copy of each row is held outside the repo tree against loss (BUILD_RULES §3). A later reader finding these rows uncommitted in a working tree is seeing the intended state, not an accident. **Consequence, stated here so it is not discovered mid-sequence: the tree is DIRTY from this row onward, and `preflight-at-sha.js` refuses on a dirty tree** — see the note at the end of this row.

   **THE ACTIVATION SHA: `ca62b2b0f4236d2bc3bd93fcce7eab5d56d0f4b4`** (PR #779, the step-0 re-run log commit, merged 2026-08-19 17:01:35 −05).

   *Pre-pin verification, all four conditions, before the preflight was run.* **`main` tip** `ca62b2b0f4236d2bc3bd93fcce7eab5d56d0f4b4`, read after `git fetch origin`, local `main` == `origin/main`, **tree clean**. **Deployed** `dpl_6gtjoGDhQqVoxqSLB78L9p4sMskb`, created 2026-08-19 17:01:39 −05, status Ready, holding the apex aliases `fantasytrades.io` / `www.fantasytrades.io` — the deployment actually serving. Its SHA is read from the deployment's own build log, quoted rather than paraphrased: `Cloning github.com/fashraf94/TradeSeven (Branch: main, Commit: ca62b2b)` at `2026-08-19T22:01:40.012Z`. **Equal: yes.** **Nothing else landed:** `7c70ae6b..ca62b2b0` contains exactly two commits — `d4626ef2` (the step-0 re-run log) and its merge `ca62b2b0`, whose parents are exactly `7c70ae6b` + `d4626ef2` — and the whole range touches ONE file, `ACTIVATION_RUNBOOK.md`, +49 / −3. No code moved between the 0.2 at `7c70ae6b` and this pin.

   **The preflight of record — `preflight-at-sha.js --sha ca62b2b0f4236d2bc3bd93fcce7eab5d56d0f4b4`, harness exit 0, verdict `PASS`, 5/5 suites `green`**, report `scripts/composition/out/preflight-ca62b2b0f423.json` (`ranAt` 2026-08-19T22:13:04.746Z, `treeClean: true` — the tree was still clean when this ran; the row you are reading was written after it):

   | Suite | Spec | Result (spawn status) | Rows |
   |---|---|---|---|
   | `compositionWriterCensus` | `api/_utils/compositionWriterCensus.test.js` | **green (0)** | 6 |
   | `compositionProtectedStores.scan` | `api/_utils/compositionProtectedStores.scan.test.js` | **green (0)** | 9 |
   | composition battery | `api/_utils/composition*` | **green (0)** | 205 across 18 files |
   | fence behavior | `api/agent/composition.fenceBehavior.test.js` | **green (0)** | 45 |
   | candidate registry + default traits | `archetypeCompatibilityCandidate` + `archetypeDefaultTraits.composition` | **green (0)** | 20 |

   The harness writes `green` only for spawn status 0; a suite that ran and failed renders `exit <n>` and one that never started renders `did-not-run` — so `green` IS the recorded exit code, and the R6 three-outcome split means none of these five is a silently-unrun suite. Census green ⇒ **no newly-discovered writer**; the PR #716 casualClone reconciliation branch is not entered.

   **⚠ SUPERSESSION — THE 0.2 AT `7c70ae6b` DOES NOT CARRY.** That run was green, and it stays in the log as the row that re-closed step 0, but it is **not this pin's evidence**. The pin's evidence is the run above, at `ca62b2b0`, and nothing else. This is the whole point of 1.2 re-running the COMPLETE step-0 preflight at the FINAL deployed SHA rather than inheriting step 0's: a preflight proves something about the tree at one SHA, and the deployed artifact has moved since. The two SHAs differ by one docs-only commit here — which is exactly the case where inheriting would feel harmless and would still be wrong, because the invariant is structural, not a judgement about how risky the diff looked.

   **MANUAL GATE (F5), signed at the pin:** `composition/activation` does not exist in production (observed this session), so the "flag must never be false while a record exists" condition is not yet live; `COMPOSITION_EPOCH_FENCE_ENABLED` is `true` in the deployed build regardless (`compositionConfig.js:43` at `ca62b2b0`), which is the safe side of the gate.

   **FROM THIS ROW FORWARD: NO COMMIT, NO DEPLOY.** Any commit or deploy re-opens step 1 from 1.1 and voids this pin — not "should not", but "does": nothing in this runbook makes a post-pin commit safe, and the pin is the only thing tying every later step's evidence to one artifact.

   **Input for 1.3, recorded at the pin:** the new deployment **began serving** between `2026-08-19T22:11:45Z` (build completion — cache upload finished) and `2026-08-19T22:12:39Z` (the first check that CONFIRMED the apex alias resolving to `ca62b2b`). **1.3's wait is measured from SERVING, and conservatively from the later bound, `22:12:39Z`.** The configured `maxDuration` ceiling across `api/` is **300 s** (11 functions hold it, including `agent-evaluate` and `tournament-orchestrator`; `c3d75833` raised only `ensure-casual-clone` 10 → 60 and does not move the ceiling), so the earliest 1.3 may close is `2026-08-19T22:17:39Z`.

   **Dirty-tree consequence, resolved in advance rather than mid-sequence.** `preflight-at-sha.js` is invoked at exactly two places in this runbook — step 0.2 and this step — and **nothing from 1.3 through step 9 runs it**: `migration-scan.js` (steps 2/3/4), `check-rules-deploy-gate.js` (1.4) and `lease-ops.js` (1.9 / 8B) contain no `git rev-parse` or `status --porcelain` precondition, verified by inspection. Its report artifact lands in the gitignored `scripts/composition/out/`, so preflight runs never dirty the tree themselves. **The one path where the accumulated uncommitted rows WOULD block a preflight is a RESTART FROM 1.1** — which this runbook triggers in two places: a 1.7 snapshot-smoke failure ("stop, fix the bundling, redeploy, restart from 1.1"), and any commit or deploy landing after this pin. On that path the log must be stashed or committed to a hold branch BEFORE re-running 1.2's preflight, and restored after; the byte-exact scratchpad copies are the safety net that makes that recoverable.
3. **Old-deployment-invocation drain (#8):** invocations of PREVIOUS deployments may still be executing. Wait out the platform's maximum function lifetime (Vercel: the configured `maxDuration` ceiling) — or trigger the explicit drain signal if one exists — and record the wait. Nothing that follows may race code from a prior SHA.
   **1.3 RECORDED — 2026-08-19 17:17 −05. WAIT SATISFIED.** *(Deliberately uncommitted, per the 1.2 block.)* · **Waited 314 s against a 300 s ceiling.**

   **The basis, stated because the choice of clock is the whole content of this step.** The wait was measured **from SERVING, not from build completion** — an invocation of a prior deployment can only be racing us while the new artifact is actually taking traffic, and build completion is strictly earlier than that, so measuring from it would credit us with time the old code was still the one serving. Serving began somewhere in the interval `2026-08-19T22:11:45Z` (build cache upload finished — the last build-log line) to `2026-08-19T22:12:39Z` (the first check that CONFIRMED the apex alias resolving to `ca62b2b`). **The LATER bound was chosen deliberately:** the exact flip moment is not directly observable here, and taking the earlier bound would shorten the real wait by up to 54 s while appearing compliant. Start `22:12:39Z` → elapsed at the close `22:17:53Z` = **314 s ≥ 300 s**.

   **The ceiling: 300 s.** The configured `maxDuration` maximum across `api/` — 11 functions hold it, including `api/cron/agent-evaluate.js` (the sole battle-completer, which must stay scheduled) and `api/cron/tournament-orchestrator.js`. `c3d75833` raised `ensure-casual-clone` 10 → 60 and does not move the ceiling. No explicit platform drain signal exists, so the lifetime bound is the mechanism, exactly as this step contemplates.

   **Nothing raced:** production was re-checked at the close and is still `dpl_6gtjoGDhQqVoxqSLB78L9p4sMskb` / `Commit: ca62b2b` — no deployment landed during the wait. **Pin integrity re-verified at the close:** `origin/main` and local `HEAD` both still `ca62b2b0f4236d2bc3bd93fcce7eab5d56d0f4b4` — no commit has landed since the pin.

   *Honest limit on the claim:* this bounds the LIFETIME of prior-SHA invocations; it is not an observation that zero such invocations were in flight. The platform exposes no per-invocation drain signal, so "no function from a prior SHA can still be running" is derived from the ceiling, not measured. That is what the step asks for, and it is what is claimed here — nothing more.
4. **B9 re-verification:** the rules deploy + gate ran at step −1; confirm `check-rules-deploy-gate.js` still PASSES against the filled record at the activation SHA.

   **1.4 RECORDED — 2026-08-19 17:18 −05. B9 GATE: PASS.** *(Deliberately uncommitted, per the 1.2 block.)* · `node scripts/composition/check-rules-deploy-gate.js` → **exit 0**, `B9 GATE: PASS — deploy record + green smoke at the deployed rules text.` Run at THE ACTIVATION SHA `ca62b2b0`, against the filled `docs/composition/RULES_DEPLOY_RECORD.json` (`status: filled`, operator `Flash`, `deployedAt 2026-08-13T06:20:16Z`, smoke `compositionEpochDenials` green at `2026-08-13T15:46:51Z`).

   **The equality that carries the gate, checked explicitly rather than inferred from the exit code:** `deployedRulesSha` == `smoke.rulesTextSha256` == the sha256 of `firestore.rules` **in the tree at the activation SHA** — all three are `7bd361d818af06429ccbdd06b237663c1924b72b59ff079fe3395674c091013a`. So the deployed text, the text the emulator smoke ran against, and the text at the pinned SHA are the same bytes; the rules-layer epoch fence that the B9 gate exists to protect is the one actually live. `firestore.rules` last changed in `4d0b0e9f` (2026-08-12 22:27:56Z), **before** the record was filled, and has not moved since — including across the entire nine-merge freeze crossing, which is the finding the step-0 re-run already recorded from the other direction.
5. **Pause + POSITIVELY ACKNOWLEDGE every external admin writer (#4 — BEFORE any epoch-state write):** every row of `EXTERNAL_ADMIN_WRITE_PATHS.md` is paused AND each pause is positively acknowledged (per-row sign-off in the checklist: operator, timestamp, mechanism). No `state:'closing'` write may precede the last acknowledgment.
   **1.5 RECORDED — 2026-08-19T22:26:08Z (17:26 −05). ALL SIX ROWS ACKNOWLEDGED; THE PAUSE GATE IS CLOSED.** *(Deliberately uncommitted, per the 1.2 block.)* Per-row sign-off, operator + timestamp + mechanism, as #4 requires. Every timestamp below is the moment of the founder's acknowledgment, `2026-08-19T22:26:08Z`.

   | Row | State | Operator | Time (UTC) | Mechanism (the founder's words, recorded not paraphrased) |
   |---|---|---|---|---|
   | **E1** Firebase Console | **PAUSED** | Flash | 2026-08-19T22:26:08Z | "I will not open the Firestore Console for the duration of the window; no manual document edits." |
   | **E2** `firebase`/`gcloud` CLI | **PAUSED** | Flash | 2026-08-19T22:26:08Z | "No firestore CLI invocations except the runbook's own scripted steps, each named in the log with its timestamp." |
   | **E3** repo admin CLI scripts | **PAUSED** | Flash | 2026-08-19T22:26:08Z | "I will not invoke them." — **PURELY PROCEDURAL until 1.9's close** (see the correction below); "the guard is not the plan here; my not running them is." |
   | **E4** `migration-scan.js --apply` | **NOT PAUSED — acknowledged** | Flash | 2026-08-19T22:26:08Z | Runbook step 3, epoch-fenced, runs exactly once. Not a pause by design. |
   | **E5** Vercel service accounts | **SATISFIED BY EVIDENCE** | Flash | 2026-08-19T22:26:08Z | THE ACTIVATION SHA `ca62b2b0` == the deployed SHA, preflight green at it (`preflight-ca62b2b0f423.json`) — the control this row names, already recorded at 1.2. |
   | **E6** local dev with prod creds | **PAUSED** | Flash | 2026-08-19T22:26:08Z | "No local run against prod credentials for the window; the one prod key is on this machine and I am the only operator." |

   **The ordering constraint this step exists to enforce is met:** no epoch-state write has occurred — `composition/writeEpoch` is still ABSENT at this moment — so **no `state:'closing'` (nor any other epoch-state write) precedes the last acknowledgment above.** 1.6 is the first write of the run and is now unblocked. **Pin integrity re-verified at the sign-off:** `origin/main` == `HEAD` == `ca62b2b0f4236d2bc3bd93fcce7eab5d56d0f4b4`, production still `Commit: ca62b2b` — no commit, no deploy since the pin.

   **⚠ E3 CORRECTION — accepted by the founder at the sign-off, and FILED AS A DOC CORRECTION FOR PR 5.** `EXTERNAL_ADMIN_WRITE_PATHS.md`'s E3 row says these scripts "DO carry the in-code guard (`assertWriteEpochOpen` / lease), so a closed epoch rejects them — the guard is the backstop, not the plan." **That belt is not fastened yet, and the row's wording anticipates it.** `assertWriteEpochOpen` (`compositionWriteEpoch.js`) rejects only on a doc that EXISTS and is not open — `if (snap.exists && snap.data().state !== 'open')` — and returns `null` (fail-open) on an ABSENT doc, with no activation-record check. Its transactional sibling `validateWriteEpochInTx` has exactly that arm (`absent_epoch_doc_post_activation`, B1); this one does not. Since `composition/writeEpoch` does not exist until 1.6, **E3's pause is procedural — identical in kind to E1/E2/E6 — from now until 1.9 sets the doc `closing`/`closed`.** Nothing is broken and no claim in the runbook depends on the belt being live during this interval; the row simply reads stronger than the code is at this point in the sequence. **PR 5 action: reword E3 to state that its code backstop arms only from 1.9's close.**

   **⚠ CARRIED ONTO THE 1.9 CHECKLIST (the 08-16 review already flagged this; re-confirmed by inspection here).** The `assertWriteEpochOpen` absent-doc asymmetry is not merely cosmetic post-activation: once a record exists, a missing epoch doc would let `assertWriteEpochOpen`'s callers — background loops and the one post-commit rules writer (`archetypeSeeding.js:142`) — through, while every transactional writer correctly fails closed. **At 1.9, confirm the epoch doc EXISTS and is `closed` before relying on any `assertWriteEpochOpen`-guarded path being fenced**, and do not treat that helper as a B1-equivalent belt.
6. **Open the epoch EXPLICITLY:** **`transitionWriteEpoch(db, { state: 'open', epochId: '<E0, new>' })`** ⇒ `{state:'open', epochId:E0, fenceGeneration:1}` — today's implicit fail-open world made explicit, at **incarnation 1** (BL1: every epoch-state write goes through the helper, which computes `fenceGeneration` mechanically — a quiesced world becoming writable increments it; closes retain it; clients and server transactions pin the {epochId, fenceGeneration} TUPLE, so no later incarnation can re-admit an earlier incarnation's mutation). Required now: the genesis write arms B1, and the armed world must never see an absent epoch doc.
   **1.6 RECORDED — 2026-08-19T22:31:19Z (17:31 −05). THE EPOCH IS OPEN. THIS IS THE FIRST WRITE OF THE RUN.** *(Deliberately uncommitted, per the 1.2 block.)* · Call, through the helper and never a raw doc write: **`transitionWriteEpoch(db, { state: 'open', epochId: 'E0-20260819' })`**.

   **PRE-WRITE STATE, recorded because it is what makes `fenceGeneration: 1` meaningful:** `composition/writeEpoch` was `exists: false` immediately before the call (the script REFUSES if it already exists). So incarnation 1 here is a genuine first incarnation computed from an absent prior — `(prior?.fenceGeneration ?? 0) + 1` — not a retain of some pre-existing value.

   **HELPER RETURN — verbatim, as `transitionWriteEpoch` computed it (not as expected):**

   ```json
   { "state": "open", "epochId": "E0-20260819", "fenceGeneration": 1 }
   ```

   **INDEPENDENT READ-BACK — a fresh `.get()` outside the transaction, so this is an observation of what landed rather than an echo of the return value:**

   ```json
   { "path": "composition/writeEpoch", "exists": true,
     "data": { "state": "open", "epochId": "E0-20260819", "fenceGeneration": 1 },
     "createTime": "2026-08-19T22:31:19.466Z", "updateTime": "2026-08-19T22:31:19.466Z" }
   ```

   **COMPARE: field-by-field over the union of both key sets — `epochId`, `fenceGeneration`, `state` — `match: true`, `divergences: []`.** `createTime` == `updateTime`, confirming a create rather than an overwrite of something that was already there. The doc matches this step's stated expectation on all three fields: state open, epoch id `E0-20260819`, fence generation 1.

   **What is now true.** Today's implicit fail-open world is EXPLICIT, at **incarnation 1**; clients and server transactions pin the `{epochId, fenceGeneration}` TUPLE from here. The armed world will never see an absent epoch doc when genesis lands at 1.8, which is the reason this step precedes it. **`assertWriteEpochOpen`'s backstop is now real for the E3 script class** — the doc exists, so a later non-open state rejects through it (the 1.5 correction's interval has closed at its lower end; the checklist item carried to 1.9 still stands for the post-activation absent-doc case).

   **ROLLBACK POINT, restated at the moment it becomes live:** from this write on, reopening is **ONLY** `transitionWriteEpoch(db, { state: 'open', epochId: 'E0-20260819' })` — **never a raw doc write** (Sol's final blocker: a raw reopen resurrects the incarnation ABA that batch 12 removed) — and the returned **`fenceGeneration: 2`** must be VERIFIED AND LOGGED when that happens, because a closed→reopen of the same epoch mints the next incarnation and kills every pre-close client token and server pin.
7. **Deployed-lambda snapshot smoke (#9 — BEFORE genesis):** invoke a REAL deployed path that resolves **v2 via the bundled historical snapshot** AND **v3 via the catalog** (the F7 `includeFiles` verification made concrete — e.g. an internal-caller probe of the version-parameterized resolver at both versions). **Record BOTH identity hashes** in the log; they must equal the catalog-lock values. **Failure ⇒ do NOT write genesis** — stop, fix the bundling, redeploy, restart from 1.1.
   **1.7 RECORDED — 2026-08-19T22:44Z (17:44 −05). SUBSTITUTED SCOPE (founder ruling at this step) — B1 + B2 BOTH PASS. GENESIS IS NOT BLOCKED.** *(Deliberately uncommitted, per the 1.2 block.)*

   **⚠ THE STEP AS WRITTEN CANNOT BE EXECUTED — a FINDING, not a workaround, and the reason the scope was substituted.** This step calls for "a REAL deployed path that resolves v2 via the bundled historical snapshot AND v3 via the catalog… e.g. an internal-caller probe of the version-parameterized resolver." **No such deployed path exists at THE ACTIVATION SHA**, verified across all 189 endpoint files: (a) only `api/mandate/create.js:26` and `api/mandate/escape.js:21` import the registry at all, and both take only `listArchetypeIds`; (b) **no endpoint response carries `identityHash`** anywhere outside `api/_utils/`; (c) there is no probe/debug/diagnostic registry endpoint, so the `adminSecretAuth.js` internal-caller mechanism has nothing to authenticate against. **This is the same defect class as review finding R2** — the runbook named a mechanism nothing in the repo could perform — caught there before 1.2 and fixed; here it was not. **Building the probe is the only literal satisfaction and costs the pin** (a commit + deploy re-opens step 1 from 1.1, with the epoch already open), so the founder ruled it not worth voiding the pin.

   **⚠ AND THE STEP'S DESCRIPTION DOES NOT MATCH THE CODE — filed as a wording defect for PR 5.** `getArchetypeDefinition(codeId, {identityVersion})` (`archetypeRegistry.js:115-122`) returns stored snapshot content **only for versions strictly BELOW the live version**. With live = 2: **v2 resolves in-code (it IS the live composition), and v3 resolves in-code via `buildCandidateArchetypeDefinition` — neither reads a bundled file.** A probe at v2 and v3, had one existed, would have exercised the `includeFiles` bundling **not at all**. Only **v1** reads a file today, and nothing in production selects it (`selectIdentityVersion` returns live absent a record), so **the bundled snapshots are read by no live path at this moment.** The risk the step guards is nevertheless real and correctly placed before genesis: after step 7 flips live to v3, **v2 becomes a prior version and starts being read from `docs/registry-snapshots/`** — if the bundling were broken, every v2 resolution would return null and callers would fail closed, discovered only after the flip.

   **B1 — DOES `includeFiles` RESOLVE THE SNAPSHOTS INTO THE FUNCTION BUNDLES? YES, ALL THREE, INTO ALL 187.** Local `npx vercel build` at THE ACTIVATION SHA (`ca62b2b0`), exit 0, "Build completed successfully"; `.vercel` is gitignored (`.gitignore:63`) so the tree is undisturbed. **187 of 187 function bundles carry all three snapshot files**, zero exceptions:

   | Measure | Result |
   |---|---|
   | function bundles produced | 187 |
   | configs whose `filePathMap` names the snapshots | **187 / 187** |
   | configs carrying **all three** (v1, v2, v3) | **187 / 187** |
   | bundles missing any | **none** |

   The evidence is each function's `.vc-config.json` `filePathMap`, which lists exactly `docs/registry-snapshots/archetype-registry-identity-v{1,2,3}.json` and nothing else — the only place `includeFiles` surfaces in the build output. **The mapped destination matches the path the code computes at runtime:** `SNAPSHOT_DIR` is `dirname(archetypeRegistry.js) + '../../docs/registry-snapshots'` (`:355`), and in a bundle carrying that module (verified in `api/mandate/create.func`, which does carry `api/_utils/archetypeRegistry.js`) that resolves to `docs/registry-snapshots/` — the exact `filePathMap` destination. **Recorded so it is not misread:** the physical JSON files are **not** copied into the local `.func` directories (a bundle holds only its handler, config and package.json); the local build output is a packaging manifest and the deploy step materializes the mapped files. Their absence on local disk is expected and is NOT evidence of a bundling failure — the `filePathMap` is.

   **B2 — DOES THE FILE-READING MECHANISM ACTUALLY WORK? YES, HASH-EXACT.** v1 is the ONLY version that reads a bundled file today, so it is the live proxy for what v2 becomes after the flip. All six archetypes resolved through the real path `getArchetypeDefinition(id, {identityVersion: 1})` → `loadSnapshotVersion(1)`, zero failures, and the reconstructed identity hash is **`db5d95e863946c507469fbac4d88aab3d051327f2ce352075107031de3405654`** — **equal to the catalog-lock target and to the hash embedded in the snapshot.** Two controls, because a bare match proves little:

   - **NON-VACUITY:** the v1 content **differs** from live (`momentum_chaser` content hash `ed369b01b4407bbd…` at v1 vs `58efbf17e51bac25…` live). Had the resolver silently fallen back to the live composition, these would be identical and the hash match meaningless. It returned STORED content.
   - **FAIL-LOUD:** `identityVersion: 99` returns `null`, confirming the documented no-guess behaviour rather than a silent default.

   *Provenance, stated rather than glossed:* the **definitions** half — the part that proves the file read — comes through the resolver; the **corpus** half is read from the same stored snapshot because no version-parameterized corpus accessor exists (`getRegistryCorpus()` is always live). The stored v1 corpus happens to be identical to live, so the corpus half carries no discriminating power; the definitions half is what the proof rests on.

   **THE LIMITATION, STATED EXACTLY (founder's framing, adopted verbatim):** this verifies **build configuration and the file-reading path — NOT the running lambda's filesystem.** No code was executed inside the deployed lambda at `ca62b2b0`, because no path exists that could.

   **C — THE 8A CHECK THAT CLOSES THE GAP (named here, owed there):** immediately post-flip, while the epoch is still closed and the fleet frozen, **resolve v2 — by then a PRIOR version — through the deployed path and confirm its identityHash equals `4b44df0be60866bc042fb4adce99281878256f13d74ae0ec02924ee4778d731e`, with THE ROLLBACK PROTOCOL armed** before the check runs. That is the first moment the bundled-file read becomes exercisable through a real deployed path, and it must clear before the 8B general unfreeze.

   **Catalog-lock values of record** (the `identityHash` embedded in each committed snapshot): **v1** `db5d95e863946c507469fbac4d88aab3d051327f2ce352075107031de3405654` · **v2** `4b44df0be60866bc042fb4adce99281878256f13d74ae0ec02924ee4778d731e` (independently corroborated — it is the value `registryIdentityHash()` returned in the 0.3 drain read) · **v3** `5cd3cca189cd0292e7d86787f1583868e0867b16ec93e8b3dcbbf2361d55be66`.
8. **GENESIS (the F2 ruling — BEFORE the epoch close, paired with the open epoch doc):** **`writeGenesisDescriptor(db, { activeEpochId: '<E0>' })`** — generation 1 = the genesis descriptor `{activeIdentityVersion: 2 (live), boundaryStateVersion: 1, candidateStateId: 'genesis', semanticHash: <the reserved null-sentinel>, activeEpochId: E0, overrideRevision: 0}`. No overlay participation — the loader short-circuits to base-only; births, reads, and compiles are UNCHANGED (proven rows incl. the genesis-present pipeline row). The write validates the open epoch pairing in its own transaction and refuses if any record exists. **From this write on: B1's absent-epoch-doc-fails-closed is armed coherently, and a prior descriptor exists for every future generation.**
   **1.8 RECORDED — 2026-08-19T23:29:45Z (18:29 −05). GENESIS IS WRITTEN. GENERATION 1 EXISTS.** *(Deliberately uncommitted, per the 1.2 block.)* · Call: **`writeGenesisDescriptor(db, { activeEpochId: 'E0-20260819' })`**. Pre-write, `composition/activation` was `exists: false` (the script refuses otherwise) and the epoch doc was open at incarnation 1 — the pairing the writer validates in its own transaction.

   **THE STORED DESCRIPTOR — independent re-read of `composition/activation`, verbatim:**

   ```json
   { "activeIdentityVersion": 2, "boundaryStateVersion": 1, "activeEpochId": "E0-20260819",
     "candidateStateId": "genesis", "semanticHash": "genesis:null", "overrideRevision": 0,
     "recordedAt": null, "activationGeneration": 1 }
   ```

   `createTime` == `updateTime` == **2026-08-19T23:29:45.814Z** (a create, not an overwrite). **The helper's return equalled the stored document across all seven `ACTIVATION_DESCRIPTOR_FIELDS` (`helperReturnMatchesStored: true`).** *Capture note, recorded rather than papered over:* the head of the write run's stdout was truncated by the capture, so the helper's return is evidenced here by that field-wise equality flag and by the history row below — whose content is the same tuple — rather than by re-printing it; the write cannot be re-run to recapture it (`genesis_record_exists` aborts by design).

   **FIELD-BY-FIELD against this step's stated tuple — all seven PASS:** `activeIdentityVersion` 2 ✓ (the LIVE version — genesis selects today's identity) · `boundaryStateVersion` 1 ✓ (the Q1 framing) · `candidateStateId` `genesis` ✓ · `semanticHash` `genesis:null` ✓ · `activeEpochId` `E0-20260819` ✓ · `overrideRevision` 0 ✓ · `activationGeneration` 1 ✓. **The reserved sentinel PAIR is intact** (`bothReserved: true`) — and `writeActivationRecord` rejects either sentinel at step 7, so a real candidate run can never masquerade as genesis.

   **APPEND-ONLY HISTORY ARMED:** `compositionActivationHistory` holds exactly one doc, id `1`, carrying the same tuple plus `recordedAt: null`. **A prior descriptor now exists for every future generation — rollback-to-genesis is available from this moment.**

   **POST-GENESIS CHECKS — all four verified:**

   1. **F5 GATE, NOW ARMED — PASS.** A record exists, so the standing rule binds: `COMPOSITION_EPOCH_FENCE_ENABLED` must never be false while a record exists. Verified AT THIS MOMENT at the deployed SHA: `git show ca62b2b0:api/_utils/compositionConfig.js` → **`:43 export const COMPOSITION_EPOCH_FENCE_ENABLED = true;`**, and the deployment serving the apex is `Commit: ca62b2b` per its own build log. The flip itself is the 1.1 evidence (`91ad40b7`, deployed `2026-08-17T00:37:11Z`, `docs/audits/20260816_COMPOSITION_STEP_1_1_FLIP_REVIEW.md`); this row re-verifies it holds at the pin, as the gate text requires. **From here the flag NEVER lowers — deactivation is `rollbackActivationRecord`, nothing else.**
   2. **THE L1-1 CLIENT READ NOW RESOLVES.** `composition/activation` exists, and the DEPLOYED rules text permits any signed-in client to read it — `firestore.rules:75-77` at `ca62b2b0`: `match /composition/activation { allow read: if request.auth != null; allow write: if false; }`, the same bytes the 1.4 B9 three-way sha equality pinned. At step −1 that read returned **not-found** (allowed, record absent); the only variable that has changed is the record's existence, so it now returns the document. Control observed: an **UNAUTHENTICATED** REST read returns **HTTP 403 `PERMISSION_DENIED`**, confirming the rules layer is live and the read is auth-gated rather than open. *Honest limit:* no authenticated client-SDK read was performed — this session holds no client credentials — so the signed-in success is evidenced by the deployed clause plus the record's existence, not by an executed client read.
   3. **BIRTHS STILL RESOLVE LIVE — base only, ZERO layer reads, proven not asserted.** `loadActivatedComposition` returned **`{activated: true, genesis: true, generation: 1}`**. The `fetchLayers` adapter was **INSTRUMENTED**: it flips a flag if called. **`fetchLayersCalled: false`** — the genesis branch short-circuits before any layer read, which is the "no overlay participation" claim measured directly. `overlayEntries: 0`, `epochOverrideEntries: 0`. `resolveWith(baseDocs)` — a pure computation, zero writes — returned `effectiveDocs` **byte-equal to the input base**, with `provenance` empty and `dangling` empty. *(My first comparison compared the whole envelope `{effectiveDocs, provenance, dangling}` to the raw base and so read `false`; the passthrough claim is about `effectiveDocs`, and corrected it is TRUE.)* Birth selection: `selectIdentityVersion(descriptor)` → **2**, the live version, and the resolved definition under that version is **identical to the live definition for all six archetypes** — the non-writing birth check, a pure resolution with zero writes.
   4. **THE EPOCH DOC IS UNCHANGED BY THE GENESIS WRITE.** Before and after are byte-identical — state open, epochId `E0-20260819`, **`fenceGeneration: 1`** — and `updateTime` is **still `2026-08-19T22:31:19.466Z`**, the 1.6 value. Genesis touched the activation record and its history only; the incarnation did not move.

9. **Close the epoch:** `transitionWriteEpoch(db, { state: 'closing', epochId: 'E0' })` (the incarnation RETAINS — 1) → new writes + lease acquisitions reject → **drain provisioner leases** (`drainProvisionerLeases`; B2).

   **THE COMMAND (added 2026-08-16 — review finding R2; before this the runbook named the function and nothing in the repo invoked it, so the operator had no command to run):**

   ```bash
   node scripts/composition/lease-ops.js drain            # DRY RUN — one pass, no polling: drain / wait / refuse
   node scripts/composition/lease-ops.js drain --apply    # THE 1.9 CALL — polls until nothing is active
   ```

   Run the dry form first: it classifies instantly instead of blocking up to 150s, and it prints exactly what the live drain will do. **On a refusal the live run names every stuck holder and prints a ready-to-run `resolve` command per lease** — supply your own operator and reason (#3: a named human declares the holder dead), then re-run the drain:

   ```bash
   node scripts/composition/lease-ops.js resolve --lease-id <id> --operator "<you>" --reason "<why>" --apply
   ```

   `node scripts/composition/lease-ops.js list` gives the same registry view at any time. All three **work with the epoch CLOSED** — which is the state this step runs in — proven by `api/_utils/compositionLeaseOps.test.js`'s closed-epoch block, not assumed. Every run writes a JSON artifact under `scripts/composition/out/` for the step-9 docs closeout to cite. **A lease that expires without release does NOT drain (#3):** the drain REFUSES and names the holder — verify the holder process is dead (the max-function-lifetime bound of 1.3), then `resolveStuckProvisionerLease(db, leaseId, { operator, reason })` (attributed in the log), and re-run the drain. Then `transitionWriteEpoch(db, { state: 'closed', epochId: 'E0' })` — **the watermark** (still incarnation 1). (The epoch doc is UPDATED, never deleted — post-genesis an absent doc fails closed everywhere.)
    **1.9 RECORDED — 2026-08-19T23:42:49.557Z. THE EPOCH IS CLOSED. THE WATERMARK IS SET.** *(Deliberately uncommitted, per the 1.2 block.)* **The epoch id is `E0-20260819` throughout — never the placeholder `E0` this section's prose uses.**

    **(a) CLOSING — 23:42:20.663Z.** `transitionWriteEpoch(db, {state:'closing', epochId:'E0-20260819'})` returned `{"state":"closing","epochId":"E0-20260819","fenceGeneration":1}`; independent re-read identical (field-by-field over `epochId`/`fenceGeneration`/`state`, `match: true`). **`fenceGeneration` RETAINED at 1** — a closing transition mints no incarnation, exactly as BL1 requires (only a quiesced world *becoming* writable increments).

    **(b) DRAIN, DRY — `WOULD_DRAIN_IMMEDIATELY`** (`lease-ops-drain-2026-08-19T23-42-26-751Z.json`), no refusal, nothing written.

    **(c) DRAIN, LIVE — `{drained: true}`**, `waitedMs: 538`, `polls: 1`, no stuck holder, no `resolve` required (`lease-ops-drain-2026-08-19T23-42-33-030Z.json`). **⚠ THE EMPTY-SET CAVEAT, RECORDED AS THE STANDARD IT IS: `{drained:true}` over 0 docs is a TRUE RESULT, NOT BEHAVIOURAL EVIDENCE.** The registry held zero documents (confirmed again in the aftermath read below), because `acquireProvisionerLease` was dark until the 1.1 flip and neither holder has run since — see the 0.3 row. The drain therefore polled an empty set and returned immediately. **The evidence that the drain actually drains lives where it was built: `api/_utils/compositionLeaseOps.test.js`'s closed-epoch block** — not in this row.

    **(d) CLOSED — THE WATERMARK.** `transitionWriteEpoch(db, {state:'closed', epochId:'E0-20260819'})` returned `{"state":"closed","epochId":"E0-20260819","fenceGeneration":1}`; independent re-read identical. **`fenceGeneration` still 1** across the whole close (open → closing → closed, one incarnation throughout).

    > ### THE WATERMARK: `2026-08-19T23:42:49.557Z` (epoch millis `1787182969557`)
    > **Step 1.11's sweep keys off this exact timestamp:** every protected-store doc whose `updateTime` is at or after it must be attributable to a named runbook step.

    The doc's `createTime` remains `2026-08-19T22:31:19.466Z` — the 1.6 create — while `updateTime` moved, proving the doc was **UPDATED, never deleted and recreated** (post-genesis an absent doc fails closed everywhere, so a delete-recreate would be a defect).

    **(e) THE CARRIED `assertWriteEpochOpen` ITEM — SATISFIED.** Filed at 1.5 and due here. The helper fail-OPENS on an absent doc (`if (snap.exists && state !== 'open')`) and so may only be treated as a fence once the doc EXISTS and is not open. Confirmed at this moment: **`epochDocExists: true`, `state: 'closed'` ⇒ satisfied.** From here the E3 admin-script class is genuinely code-backed, not merely procedural — the interval opened at 1.5 is closed.

    **(f) THE FENCE IS LIVE — PROVEN, WITH ZERO WRITES.** Two probes, both rejecting `epoch_closed` and naming the epoch:

    | Probe | Result |
    |---|---|
    | `assertWriteEpochOpen(db)` — the non-transactional guard (background loops, admin scripts) | **REJECTED** — `EpochClosedError`, `code: epoch_closed`, `epochId: E0-20260819`, `state: closed` |
    | `validateWriteEpochInTx` — the transactional chokepoint every fenced writer routes through | **REJECTED BY THE FENCE** (`rejectedByFence: true`), same code / epochId / state |

    **Why these were safe, stated so the method is auditable:** probe 1 performs a single `.get()` and cannot write in any branch. Probe 2 ran inside a transaction that **queues no mutation at all** — no `tx.set`/`create`/`update` exists anywhere in it — and carries a deliberate abort on the unreachable path, so a fence FAILURE would have rolled back rather than committed. **The lease-acquisition probe was DELIBERATELY DECLINED:** `acquireProvisionerLease` mints a real lease doc if the fence fails, and that is precisely the risk not worth taking to prove a point the two probes above already prove.

    **AFTERMATH — nothing landed:** epoch `updateTime` still `23:42:49.557Z` (the watermark, unmoved by the probes); `composition` holds exactly `['activation','writeEpoch']`; lease registry still **0 docs**.

10. **Battle-drain HARD GATE (#7 — the post-watermark repeat of A26/A35):** re-run the step-0.3 predicate over active `agentBattles` NOW, after the watermark. **This result — not step 0's — is the gate:** any battle matching the predicate ⇒ wait for it to complete before step 2. Record the post-watermark count (expected 0). **`agent-evaluate` MUST be running for this gate to clear** — it is the sole battle-completer, so pausing it deadlocks this step (see the standing warning above).
11. **Watermark sweep (B8):** every protected-store doc updated after the watermark must be attributable to a named runbook step.

    **1.10 RECORDED — 2026-08-19T23:47:00Z. THE HARD GATE CLEARS: post-watermark drainCount = 0.** *(Deliberately uncommitted, per the 1.2 block.)* **This result — not step 0.3's — is the gate.** Predicate re-run over active `agentBattles` AFTER the watermark, at the live values `ARCHETYPE_IDENTITY_VERSION = 2` / `registryIdentityHash() = 4b44df0be60866bc042fb4adce99281878256f13d74ae0ec02924ee4778d731e`.

    **The zero is non-vacuous, on the 0.3 standard:** the query read all **360** `agentBattles` docs and histogrammed `status` BEFORE filtering — **360 `completed`, 0 `active`, 0 docs missing the field** — and a **stamp-presence census over the active set** returned `activeMissingStamps: 0`, so no unjudgeable battle can hide inside the zero. Zero active battles ⇒ the predicate has nothing to match on either arm. `agent-evaluate` **remained scheduled throughout**, per the standing warning — pausing it would have deadlocked this gate, since it is the sole battle-completer the drain waits on.

    *(The population is unchanged at 360 since the 0.3 re-run at 22:12Z — no battle started or completed across the close, which is what a drained fleet behind a closed epoch should look like.)*

    **1.11 RECORDED — 2026-08-19T23:47:44Z. WATERMARK SWEEP CLEAN: ZERO UNATTRIBUTABLE WRITES. STEP 1 IS COMPLETE.** *(Deliberately uncommitted, per the 1.2 block.)*

    Sweep basis: every protected-store doc whose Firestore `updateTime` metadata is **at or after the watermark `2026-08-19T23:42:49.557Z`**. Scope is the full protected surface of `compositionProtectedStoresScan.js` — `agents`, `compiledBuilds`, `composition`, `compositionCandidateState`, `compositionEpochOverrides`, `compositionProvisionerLeases`, plus **collection-group** reads of the `rules` and `bundles` subcollections so no agent's subcollection is missed. **1,432 documents scanned in full** (agents 62 · rules 1,253 · bundles 115 · composition 2 · the four others empty). No sampling, no truncation.

    | Hit | `updateTime` | Attribution |
    |---|---|---|
    | `composition/writeEpoch` | `2026-08-19T23:42:49.557Z` (**+0 ms** — it IS the watermark) | **Step 1.9(d)** — the `transitionWriteEpoch(…{state:'closed'}…)` call that SET the watermark. `createTime` still `22:31:19.466Z` (the 1.6 create), confirming update-not-recreate. |

    **TOTAL HITS: 1. UNATTRIBUTABLE: 0.** The single hit is the watermark write itself — the one doc that must appear, since the sweep's boundary is defined by it.

> **⚠ AMENDED 2026-08-20 — THIS ROW IS HISTORICAL, NOT CURRENT.** It records the sweep AS RUN at 23:47:44Z and remains true of that moment. **17 further docs now sit after the watermark** — `agents/XtuHDmqXgu9zGDIEtxui` plus 16 rule docs — from the founder's two archetype changes inside the 8B probe window (02:35:38Z / 02:42:05Z). They are ATTRIBUTABLE (a named actor, admitted by the probe gate, dispositioned at 8B as unplanned-but-accepted) but they are **not attributable to a runbook step**. A sweep re-run today returns 20 hits, not 3.

    **The sweep is demonstrably live, not silently empty:** the `>=` comparison fired (it returned the hit above), and the newest doc BELOW the watermark is `composition/activation` at `2026-08-19T23:29:45.814Z` — the 1.8 genesis write, 12m 04s before the boundary. A corpus of ancient documents could have produced a vacuous zero; this one did not.

    **On the predicted `agent-evaluate` shape — it did not arise, and that is the correct outcome.** Before this step I flagged that if a battle completed inside the window we should expect a SPLIT: the fenced identity-derived write (`activeRules` via `commitActiveRulesProjection`, fenced from the 1.1 flip at `compositionGenerationFence.js:93-104`) REJECTING while the unfenced completion writes (`agent-evaluate.js:3929,3967` — the `activeBattleId` pointer clear and the stats block) LANDED and were attributed to step 1.10 by construction. **No such touches appear**, because 1.10 shows **0 active battles** — there was nothing to complete. The prediction is recorded as unexercised rather than confirmed, so a later reader does not mistake an absent case for a tested one.

**VERIFY:** preflight green at the activation SHA; both snapshot-smoke hashes recorded and catalog-equal; B9 gate PASS; the loader returns `{activated: true, genesis: true, generation: 1}` and — **the NON-WRITING birth check (re-review #7)** — the seed plan RESOLVED under the genesis-selected version (`selectIdentityVersion` → `buildSeedPlan`) equals the live defaults, a pure computation with zero writes (the fleet is closing/closed here; the behavioral proof is the birth-parity suite row, re-executed as a resolution, not a write); drain result `{drained:true}` with zero unresolved stuck leases; post-watermark battle predicate = 0; fence suite semantics live (a probe write 409s `epoch_closed`). **ROLLBACK POINT:** reopen via **`transitionWriteEpoch(db, { state: 'open', epochId: 'E0' })`** — NEVER a raw doc write (Sol's final blocker: a raw reopen would resurrect the incarnation ABA batch 12 removed) — then **VERIFY AND LOG the returned `fenceGeneration: 2`** (closed→reopen of the same epoch mints the next incarnation; every pre-close client token and server pin died with incarnation 1). Resume the paused rows (each resume acknowledged) — genesis stays: it is generation 1 forever, selects the live identity, and changes no behavior.

## Step 2 — FINAL-DRYRUN (hard gate; founder ratifies the exact counts)

Run **`node scripts/composition/migration-scan.js`** (dry-run) at the deployed SHA against the closed fleet. The report carries `activeIdentityVersion: 3`, the affected-agent/entry/report-class counts, `semanticHash`, `runHash`.

**HARD GATE:** the founder records ratification of the EXACT counts (this file's log, below) — required because A11 moved the migration population (the six former needsBinding rows now clamp) and the item-6 substitutions (incl. the two beyond-item-6 hosts, if ratified) change the DEFAULT_TRAITS surface. `--apply` refuses without this ratification. **The A7-LOCK freeze is in force from here.**

**2 RATIFIED — 2026-08-19, founder (Flash). THE HARD GATE IS CLEARED. These are the ratified counts of record; `--apply` may proceed against them and nothing else.** *(Deliberately uncommitted, per the 1.2 block.)*

| Ratified value | |
|---|---|
| scannedAgents | **62** |
| affectedAgents | **6** |
| overlayEntries | **20** |
| byAction | **clamp 13 · replace 3 · unequip 4** |
| **semanticHash** | **`1b76ddbe5a3687d583125d4e68c02e03322a7a6c67469e971366fed60ea52f26`** |
| needsBinding | **0** (`reportClasses: {}`, zero reports of any class — A11 landed) |
| RESIDUALS_AFTER_PLAN | **empty** for every agent (the A10 reporter fix holds) |
| activeIdentityVersion | **3** |

**M12 AGREEMENT SATISFIED — two consecutive dry-runs.** Run 1 `composition-migration-2026-08-19T23-50-27-479Z` · run 2 `composition-migration-2026-08-19T23-50-48-544Z`. **`semanticHash` IDENTICAL** across both; **`runHash` DIFFERENT** (`61a25be3735f340cdd9e9fb9cd4dcd9eff1b7a3f39fb1cf41e4cf5a1103447f5` vs `38e57d43ebafe922d228240c4b9491a5a5a5d4eaf5bc5168d7495c50d528e871`). That split is the point: the semantic identity excludes `migrationRunId`, so equality across runs proves the plan is **reproducible over identical data** rather than an artifact of one invocation, while the differing run hashes prove the two runs were genuinely distinct invocations and not one result read twice.

**THE POPULATION, as ratified:** 5 training clones + **1 real user agent**. Fleet context: 62 agents = 50 CPU + 6 training clones + 6 real user agents; five of six training clones and one of six real user agents are affected. All **4 unequips and all 3 replaces fall on training clones**.

**DONNY (`F3WIPUHnLzLA22l7atLV`, analyst, owner `itWsYGf5uHd6DQ5hkJhprjw36hL2`) — RATIFIED KNOWINGLY. The founder's reasoning, recorded verbatim at his instruction:**

> "his two entries are CLAMPS, not unequips. No rule is removed and no configured behavior disappears; two parameters move to the nearest value his own archetype's adjudicated domains admit (tv-10/R-38, mb-01/R-111 — the same two cells the PR 3.5 ladder repair fixed at seed level, which his agent predates). Excluding him would leave one live agent permanently out of domain, which would make the step-4 zero-residual scan unable to come back clean and would activate an identity a live agent provably violates. The Aug 6 D1 framing said 'house/training/dev'; today's population is 5 training clones + 1 real user agent, and I am ratifying the corrected framing, not inheriting the old one. The unequip/enum-narrowing half of D1 still holds unchanged — all 4 unequips and all 3 replaces fall on training clones."

Donny's two entries, for the record: `rules/ZpkNIAEtu0DpHuE0FaT6` `paramValues.fund_score` **65 → 71** (tv-10, R-38) and `rules/dYh27I5h7Yh1kEEltWjW` `paramValues.minutes` **90 → 60** (mb-01, R-111). **The `REPLACEMENT_MAPS`-stays-empty half of the Aug 6 D1 ruling (`migration-scan.js:55-58`) is unaffected** — it governs the enum-narrowing/unequip arm, which is entirely training clones.

**⚠ COMMAND OF RECORD for steps 2 and 3 — `node scripts/composition/migration-scan.js --during-close`.** **The literal form in this step's prose CANNOT RUN against a closed fleet** and was observed failing, not assumed: plain `migration-scan.js` exits 1 with `EpochClosedError: epoch_closed { epochId: 'E0-20260819', state: 'closed' }` at `migration-scan.js:92`, because **the epoch guard fires per-agent inside the scan loop regardless of `--apply`**. `--during-close` swaps in `assertClosedEpochCandidateWindow` (satisfied here: doc exists, state `closed`) and is **read-only without `--apply --yes`** — `:138 if (!APPLY) return;` precedes every write, and `--yes` was never passed on either dry run. **FILED AS THE THIRD RUNBOOK WORDING GAP FOR PR 5**, alongside 1.7's non-existent probe path and E3's not-yet-fastened belt.

**A7-LOCK ACKNOWLEDGED IN FORCE from this ratification.** `docs/composition/ACTIVATION_EVIDENCE.json` is **UNMOVED** — clean in the working tree, byte-identical to HEAD, **sha256 `ad2875a7c87131f0458ca7e42a2be80ec72ab2d2322b4a988d07aabcbb1a5902`**, last touched by `4ab353ff` (2026-08-07), twelve days before this run. Frozen values: `archetypeIdentityVersion 2` · `ruleLibraryVersion 1` · `candidateManifestHash bb8b02bb…` · `enforcementKernelContentHash d4f89e0e…`. `composition.a7lock.test.js` recomputes all four from HEAD and is **3/3 green** at THE ACTIVATION SHA. **From here until the activation record write, any movement in those four values re-opens the gate chain (FINAL-DRYRUN → zero-residual → activation) and invalidates this ratification.**

**VERIFY:** two consecutive dry-runs agree on `semanticHash` (M12 — the runId-independent identity). **ROLLBACK POINT:** reopen the epoch via `transitionWriteEpoch` (the step-1 rollback point, incl. its fenceGeneration verify+log); no state written.

## Step 3 — `--apply --during-close` (Method B overlay, candidate namespace only)

**`node scripts/composition/migration-scan.js --apply --yes --during-close`** — writes overlay entries + the run doc (the completion sentinel, entries-first order) into `compositionCandidateState/{runId}`. Base records untouched (A32/A36/A38). **The closed-epoch authorization (Sol review #5, built at the fold):** `--during-close` swaps the general open-epoch guard for the DEDICATED inverse assertion `assertClosedEpochCandidateWindow` — the epoch doc must exist and be `'closed'` (the post-watermark freeze); open/closing/absent each refuse (`candidate_window_not_closed`, tested). **The namespace belt is UNIT-PROVEN (re-review #8):** the apply writer is the extracted `compositionCandidateApply.applyCandidateEntries`, whose mutation row redirects the write set toward `agents/*` and proves the run aborts BEFORE any Firestore write (`compositionCandidateApply.test.js` — zero writes land; sentinel order also pinned there). PR 2's general guard is untouched; without the flag the script still requires an open epoch.

**3 RECORDED — 2026-08-19T23:59:23Z. THE OVERLAY IS WRITTEN — CANDIDATE NAMESPACE ONLY. ALL SEVEN VERIFY CHECKS PASS.** *(Deliberately uncommitted, per the 1.2 block.)*

**THE CANDIDATE runId: `composition-migration-2026-08-19T23-59-09-930Z`** — this is the `candidateStateId` step 7 will name. Command of record, as ratified: `node scripts/composition/migration-scan.js --apply --yes --during-close`, exit 0.

| # | Check | Result |
|---|---|---|
| 1 | `semanticHash` == the ratified value | **PASS** — `1b76ddbe5a3687d583125d4e68c02e03322a7a6c67469e971366fed60ea52f26` in the apply summary **and on the STORED run doc**, both equal to the step-2 ratification |
| 2 | entry count == 20 | **PASS** — summary 20; **20 entry docs actually present** in Firestore |
| 3 | byAction == clamp 13 / replace 3 / unequip 4 | **PASS** — and **recounted from the STORED entry docs**, not the summary: clamp 13, unequip 4, replace 3 |
| 4 | affectedAgents == 6, same six ids | **PASS** — exact set match against the ratified ids, sorted compare |
| 5 | candidate docs landed, create-only | **PASS** — see below |
| 6 | BASE stores untouched | **PASS** — see below |
| 7 | record still at genesis | **PASS** — see below |

**(5) THE NAMESPACE, READ INDEPENDENTLY FROM FIRESTORE — not from the script's summary.** `compositionCandidateState` holds **exactly one document**, the run doc for this runId, carrying `{candidateStateId, activeIdentityVersion: 3, semanticHash, runHash, entryCount: 20, createdAt, feedEntries}`; its only subcollection is `entries`, holding **20 docs**. **Create-only confirmed per doc: `createTime` equals `updateTime` on all 20 (`allCreateOnly: true`, `anyOverwritten: []`)** — nothing was written twice. **Ids are injective** (20 ids, 20 distinct) and are base64-encoded `entryKey`s, so an id collision would have been a `create()` failure rather than a silent overwrite. The completion-sentinel order (entries first, run doc last) is the unit-proven property of `applyCandidateEntries`; the run doc's presence is therefore evidence the entry writes completed.

**(6) BASE UNTOUCHED — OBSERVED, NOT ASSUMED, AND OVER THE WHOLE CORPUS RATHER THAN A SAMPLE.** A full `updateTime` snapshot of every protected-store doc was taken **BEFORE** the apply (1,432 docs, 23:59:03Z) and re-taken after, then diffed:

- **`changedCount: 0`** — not one pre-existing protected doc moved.
- **`addedCount: 1`**, and it is `compositionCandidateState/composition-migration-2026-08-19T23-59-09-930Z` — `addedAllInCandidateNamespace: true`. (The 20 entry docs live in its `entries` subcollection, which the after-snapshot enumerates through the same collection sweep; the top-level count moved 1432 → 1433.)
- **`removedCount: 0`.**

The three named spot-checks, all with **identical before/after `updateTime`**: Donny's `rules/ZpkNIAEtu0DpHuE0FaT6` (`2026-06-04T17:30:39.950Z`) and `rules/dYh27I5h7Yh1kEEltWjW` (`2026-06-04T17:30:41.105Z`) — **still carrying their June values, three months old, untouched by an apply that plans to clamp both** — and the training-clone bundle `training-agent-Ug4ez…/bundles/e6BkeNJBYiPKLtZhPq6g` (`2026-07-20T11:02:11.491Z`), the doc carrying the most entries of any in the plan. **This is the A32/A36/A38 Method-B guarantee measured directly: the plan describes changes to these documents and the apply wrote none of them.**

**(7) THE RECORD STILL POINTS AT GENESIS — THE OVERLAY IS INERT.** `composition/activation` is unchanged: `candidateStateId: 'genesis'`, `activationGeneration: 1`, `activeIdentityVersion: 2`, `semanticHash: 'genesis:null'`, `updateTime` still `2026-08-19T23:29:45.814Z` (the 1.8 write). It **does not point at the runId** (`doesNotPointAtRunId: true`). Nothing reads the overlay until step 7 repoints the record, so every production resolution is still base-only at live identity v2.

**ROLLBACK POSTURE AT THIS STEP — different in kind from every step before it.** The candidate namespace is INERT: no record names it, so nothing resolves through it. The remedy is not to reverse a write but to **abandon the runId** — leave it in place, unreferenced, and stop. Nothing needs undoing.

**VERIFY:** the apply summary's `semanticHash` equals the ratified dry-run's; `entryCount` equals the ratified entry count. **ROLLBACK POINT:** the candidate namespace is inert (nothing reads it without the record) — abandon the runId and stop, or proceed.

## Step 4 — Zero-residual verification through THE resolver

Re-run the scan in verify mode: the scanner observes base+overlay through `resolveEffectiveConfig` and must report **zero residuals** (A42); an old-identity read still observes pure base.

**4 RECORDED — 2026-08-20T00:08:01Z (2026-08-19 19:08 −05). ZERO RESIDUALS ACROSS THE FULL FLEET. A42 SATISFIED.** *(Deliberately uncommitted, per the 1.2 block.)* Resolution was performed through **`resolveEffectiveConfig` over base + THE STORED OVERLAY**, with the overlay entries **read from Firestore** (the ratified candidate state) rather than re-planned — so this verifies what was actually written at step 3, not what the planner would produce a second time.

**(1) FULL-FLEET RESIDUAL COUNT — `TOTAL_RESIDUALS_OVERLAY: 0`.** All **62** agents scanned, not only the six affected: `agentsWithAnyResidual: []`. A residual on an unaffected agent would have meant the plan missed something; there are none. Every one of the six affected agents reports `RESIDUALS_overlay: 0` with **`dangling: []`** — no overlay entry failed to find its target doc or field, which is the separate failure mode a bare zero would hide.

| Agent | Overlay entries applied | `provenance` entries | Residuals (overlay) | Residuals (base-only) |
|---|---|---|---|---|
| `F3WIPUHnLzLA22l7atLV` (Donny) | 2 | 2 | **0** | 2 |
| `training-agent-2jkl5…` | 4 | 4 | **0** | 3 |
| `training-agent-8osyI…` | 3 | 3 | **0** | 3 |
| `training-agent-SbXd6…` | 2 | 2 | **0** | 2 |
| `training-agent-Ug4ez…` | 5 | 5 | **0** | 3 |
| `training-agent-jsvFB…` | 4 | 4 | **0** | 3 |
| all 56 other agents | 0 | 0 | **0** | 0 |

`provenance` count equals entries applied on every row — each of the 20 stored entries is recorded by the resolver as having actually been applied from the `overlay` layer.

**(2) DONNY — THE OBSERVATION THAT SETTLES THE RATIFICATION.** Resolved through the overlay:

| Param | Base | **Effective through overlay** | Expected |
|---|---|---|---|
| `fund_score` (`rules/ZpkNIAEtu0DpHuE0FaT6`, tv-10/R-38) | 65 | **71** | 71 ✓ |
| `minutes` (`rules/dYh27I5h7Yh1kEEltWjW`, mb-01/R-111) | 90 | **60** | 60 ✓ |

Both carry resolver `provenance: 'overlay'`. **Base-only he shows 2 residuals; through the overlay he shows 0.** This is precisely the founder's ratification reasoning, now observed rather than argued: he was out of domain on those two cells, the clamps bring him into the adjudicated domain, no rule was removed, and the fleet can pass zero-residual with him included. Excluding him would have left `TOTAL_RESIDUALS_OVERLAY: 2` and this gate could not have come back clean.

**(3) NON-VACUITY — THE CONTRAST, BOTH NUMBERS.** Same scanner, same documents, same overlay set, one variable changed (`includeOverlay`):

> **BASE-ONLY resolution: `TOTAL_RESIDUALS_BASE_ONLY: 16`** · **OVERLAY resolution: `TOTAL_RESIDUALS_OVERLAY: 0`**

A resolver that ignored the overlay and returned base would have reported **16**, not 0. The zero is therefore the overlay doing work, not the scanner finding nothing to complain about. *(The 16 base-only residuals do not equal the 20 overlay entries, and should not: several entries fix the same underlying violation in both the rule doc and its bundle snapshot, and the unequip entries remove a rule that the residual scanner counts once — the two numbers measure different things, which is why the contrast is stated as a contrast and not as an arithmetic identity.)*

**(4) THE OVERLAY SOURCE IS THE RATIFIED RUNID — verified, not assumed.** `compositionCandidateState` contains **exactly one** candidate state, `composition-migration-2026-08-19T23-59-09-930Z` (`onlyOneCandidateState: true`), whose run doc carries `entryCount: 20` and `semanticHash 1b76ddbe…` — the ratified value. **20 entry docs read**, and **every one is stamped `migrationRunId` = that runId** (`distinctRunIdsAcrossEntries` has exactly one element). No other candidate state exists to have been read by mistake.

**An old-identity read still observes pure base** — the base documents were never modified (step 3's 1,432-doc diff, `changedCount: 0`), so any consumer resolving without the overlay sees exactly what it saw before this run. That is the same fact the base-only column above measures from the other direction.

**VERIFY:** `RESIDUALS_AFTER_PLAN` empty for every agent. **ROLLBACK POINT:** same as step 3.

## Step 5 — Candidate-scoped pipeline, in the Phase-0-proven order (A37)

With the candidate flags deployed (step 1) and **the record at GENESIS** (#11 — post-genesis the record ALWAYS exists; nothing infers candidate status from its absence), run the candidate pipeline **scoped EXPLICITLY to `{candidateStateId: <the step-3 runId>, activeIdentityVersion: 3}`** — the pipeline tooling passes `candidateMode: true` and the target version as explicit parameters; it never derives candidate status from the flag or the record state (which, at genesis, correctly resolves LIVE for every production compile — the genesis-present pipeline row pins this). Sequence: enable candidate manifest writing → **candidate-compile step** → verify candidate manifests → enable candidate shadow assembly → verify candidate shadow. (The compiled builds minted here carry the candidate vector fingerprint — `projectedRulesHash` — and, until the X6 base-metadata arc, `metadata_missing` validation entries; the honest-expectations rider of §II applies: **no gate-green is claimed by this event**.)

**5 RECORDED — 2026-08-20T00:14Z. SCOPE SUBSTITUTED BY FOUNDER RULING (option B now, option C at 8B). OPTION A REFUSED.** *(Deliberately uncommitted, per the 1.2 block.)*

**⚠ FINDING — THE STAGE'S TOOLING DOES NOT EXIST AS DESCRIBED. FILED AS THE FOURTH RUNBOOK WORDING/MECHANISM GAP FOR PR 5** (with 1.7's non-existent probe path, step 2's unrunnable literal command, and E3's not-yet-fastened belt). Read-only identification across all 189 endpoints and every script:

| Stage | Entry point | Verdict |
|---|---|---|
| enable candidate manifest writing | `MANIFEST_WRITE_ENABLED` (`featureFlags.js:1127`) — **already `true`** | no action exists; NOT candidate-specific |
| candidate-compile | `writeCompiledBuildsInTx` | **no command/script exists** — 11 call sites, all fenced HTTP endpoints |
| verify candidate manifests | — | **none exists** |
| enable candidate shadow assembly | `SHADOW_ASSEMBLY_ENABLED` (`featureFlags.js:1149`) — **already `true`** | no action exists; NOT candidate-specific |
| verify candidate shadow | — | **none exists** |

**Neither "enable" is a flag flip to perform** — both flags are already live and neither is candidate-scoped, so **no commit or deploy is implied and the pin is not at risk from this stage.** `scripts/composition/assemble.mjs` and `generate_manifest_and_diff.mjs` are authoring-time CELL tooling writing repo files; they are not the runtime pipeline. **Every productive stage writes OUTSIDE the candidate namespace** — compile → `agents/{id}/compiledBuilds/{mode}` (`compileOnSettingsChange.js:420`), manifests → the battle doc's `resolvedAgentManifest` (`agentBattleService.js:236`), shadow → `agentBattles/{id}/shadowDiffs/{tickId}` + `battleSettlements/{id}` — which is a STOP by the step's own namespace discipline, and is blocked twice over anyway (closed epoch rejects all 11 compile endpoints; manifests/shadow need a live fleet, and 1.10 recorded 0 active battles).

**OPTION A (build the tooling) REFUSED by the founder:** a commit and deploy now voids the pin with the epoch closed, genesis written and an overlay applied — materially worse than before 1.6, for tooling the run can do without.

**B — IN-MEMORY CANDIDATE RESOLUTION, ZERO WRITES. PASS.** `prepareCompileInputs` / `writeCompiledBuildsInTx` driven with **EXPLICIT `candidateMode`** against real agent data through a fake transaction whose mutation methods only RECORD the intended write — the object holds no batch and no Firestore write path, so nothing could land even if a code path tried. Two agents: **Donny** (`F3WIPUHnLzLA22l7atLV`, the real user agent) and `training-agent-Ug4ez…` (most entries in the plan). Both compile modes resolved (`baggerbomb_agent`, `baggerbomb_tournament`).

**THE CONTRAST — same agent, same data, one variable (`candidateMode`):**

| Measure | `candidateMode: false` (live) | `candidateMode: true` (candidate) |
|---|---|---|
| compile inputs — Donny | `ruleDocs: null`, `allBundles: null` | **`ruleDocs: 8`, `allBundles: 1`** |
| compile inputs — training clone | `ruleDocs: null`, `allBundles: null` | **`ruleDocs: 168`, `allBundles: 26`** |
| `sourceRevisionVector.projectedRulesHash` — Donny | **key ABSENT** | **`e093f5ba3ee2fdf33085bb9649bcdf3559b4c696bf08c763f3774e8e52abf1be`** |
| `sourceRevisionVector.projectedRulesHash` — training clone | **key ABSENT** | **`d23816ea5f65c99a58d587bd46124904a50ea8ab55ef231e59ded18d1b4f20e2`** |
| `contentHash` — Donny | `d70fce75…` | `ff98b190…` (**differ**) |
| `contentHash` — training clone | `25f0cddc…` | `a2fada71…` (**differ**) |
| validation — Donny | pass `true`, 0 errors | pass `false`, **26** entries (`metadata_missing`, `param_out_of_domain`) |
| validation — training clone | pass `true`, 0 errors | pass `false`, **140** entries (`metadata_missing`, `compat_cell_missing`, `param_out_of_domain`) |
| builds identical? | **NO — `buildsDiffer: true` on both agents** |

**The candidate build carries `projectedRulesHash` and the live build omits the key entirely** — the step's first VERIFY condition, satisfied at the resolution level. Identical builds would have been a finding; they differ on every axis the matrix predicts. **The `metadata_missing` and `compat_cell_missing` validation entries are EXPECTED, not defects** — §II's honest-expectations rider and the X6 base-metadata arc: **no gate-green is claimed by this event.**

*Measurement correction, recorded because the first pass was wrong:* my initial probe read `build.projectedRulesHash` at the top level and saw `null` in BOTH modes, which would have read as the VERIFY condition failing. `projectedRulesHash` actually lives inside `sourceRevisionVector` (`compileBuild.js:490`). That was a probe error, not a code defect; the corrected path is what the table reports.

**ZERO WRITES — CONFIRMED AFTER THE FACT, NOT JUST BY CONSTRUCTION.** The fake transaction captured exactly 4 intended writes (2 per agent, one per mode), **all** matching `agents/*/compiledBuilds/{mode}` (`allWriteTargetsAreCompiledBuilds: true`). Post-run reads: `collectionGroup('compiledBuilds')` = **0 documents** fleet-wide, 0 at or after the watermark; epoch doc unchanged (`closed`, `E0-20260819`, `fenceGeneration 1`, `updateTime` still `23:42:49.557Z`); activation record unchanged (generation 1, `candidateStateId: 'genesis'`, `updateTime` still `23:29:45.814Z`).

**WHAT B DOES AND DOES NOT EVIDENCE — stated plainly at the founder's instruction.** It **PROVES the compile path resolves candidate cells**: candidate mode reads the unified host projection, mints a distinct build, and stamps the candidate vector fingerprint. It **DOES NOT produce stored candidate manifests or shadow captures** — no `resolvedAgentManifest` was written to any battle, no `shadowDiffs` record exists, no CompiledBuild document is stored. Manifest rev-match and manifest-anchored shadow capture are **NOT evidenced by this row**.

**C — THE STAGE'S REAL VERIFY MOVES TO 8B (named item, owed there).** Immediately post-flip, inside the probe-gated window where named operator writes are legitimate, a **probe deploy + probe battle** produce these artifacts through real deployed paths: candidate builds carrying `projectedRulesHash`, **manifests rev-matching**, and **shadow capture manifest-anchored**. **This step's VERIFY reads as if it were written for that window** — 8B already enumerates a probe deploy and battle, so the conditions land there naturally rather than being substituted for. **This is the SECOND named 8B item**, alongside the C check owed from 1.7 (resolve v2 as a prior version through the deployed path, confirm `4b44df0be6…`, rollback armed).

**A SWEEP BLIND SPOT FOUND AND FIXED HERE, BEFORE STEP 6 (which is itself a sweep).** `compiledBuilds` is a **SUBCOLLECTION** (`agents/{id}/compiledBuilds/{mode}`), but the 1.11 watermark sweep and the step-3 base-untouched diff swept it **top-level only**, alongside collection-group reads for `rules` and `bundles`. A document at `agents/*/compiledBuilds/*` would have been missed by both. **Checked rather than assumed: `collectionGroup('compiledBuilds')` holds 0 documents fleet-wide and 0 at or after the watermark, so both prior results stand unchanged** — 1.11's zero unattributable writes and step 3's `changedCount: 0` are still correct. But they were correct because the collection is empty, **not by construction**, and that is a weaker guarantee than those rows implied. Both sweep scripts now carry `compiledBuilds` as a collection group so **step 6 inherits a correct sweep rather than the blind spot**. Filed for the PR-5 record.

**VERIFY:** candidate builds carry `projectedRulesHash`; manifests rev-match; shadow capture manifest-anchored. **ROLLBACK POINT:** candidate artifacts are self-invalidating (vector-keyed); abandon and stop.

## Step 6 — Stale-artifact sweep

Sweep the item-10 census locations (A15): every stored artifact whose source vector predates the candidate boundary must read STALE through its own reader (`diffSourceRevisionVector` presence-aware compare — the 3.5 F1 fix). Record the sweep output.

**6 RECORDED — 2026-08-20T00:23:36Z. SWEEP COMPLETE — MIXED RESULT: the comparator's own location is EMPTY, four other locations are NOT.** *(Deliberately uncommitted, per the 1.2 block.)* Swept with the **corrected** scripts — `compiledBuilds` as a COLLECTION GROUP, per the step-5 fix.

| Location | Reader | Artifacts | Result |
|---|---|---|---|
| `agents/{id}/compiledBuilds/{gameMode}` | `deployBuildValidation.js:177` — `diffSourceRevisionVector` (the P2.4b deploy gate) | **0** | **EMPTY** — nothing to read stale |
| `agentBattles/{id}.resolvedAgentManifest.versionStamps` | A26/A35 drain predicate + advisory admissibility (manifest/slice pair, in-doc) | **80** | **47 STALE against live identity** |
| `agentBattles/{id}/shadowDiffs/{tickId}` | `shadowAssemblyCapture` — manifest-anchored | **530** | historical; anchored to their own manifest |
| `battleSettlements/{battleId}` | `completeBattle` §6.4 attach | **78** | historical |
| `compositionCandidateState/{runId}` | the loader — resolves ONLY when the record names the runId | **1** | inert at genesis (does not resolve) |

**⚠ THE STEP'S OWN COMPARATOR HAS NOTHING TO COMPARE — SAID PLAINLY, NOT DRESSED AS A CLEARANCE.** `diffSourceRevisionVector` is the reader for exactly ONE location, `agents/{id}/compiledBuilds/{gameMode}`, and that location holds **0 documents fleet-wide** (verified as a collection group, not top-level). So "every stale artifact rejects through its own reader" is **VACUOUSLY TRUE here** — the same shape as the 1.9 drain's `{drained:true}` over an empty registry, and recorded to the same standard. **This is a true result, NOT a positive clearance.** The behavioural evidence that the comparator rejects stale builds lives where it was built: **the PR 3.5 review-F1 comparator rows in `compileBuild.candidate.test.js` (vector-hash movement) and the deploy-gate rows in `deployBuildValidation.test.js`** — not in this row.

**THE COMPARATOR ITSELF WAS DRIVEN, since the store could not exercise it** (pure function, zero writes) — the F1 presence-aware arm on every case:

| Case | Verdict |
|---|---|
| both ABSENT (legacy/dark world) | **fresh** — `[]` |
| stored ABSENT, boundary EXPECTS it (a dark build at the candidate boundary) | **STALE** — `["projectedRulesHash"]` |
| both present, DIFFERENT (a trait-doc / draft-bundle edit moved it) | **STALE** — `["projectedRulesHash"]` |
| both present, EQUAL | **fresh** — `[]` |
| stored PRESENT, expected absent (candidate → legacy direction) | **STALE** — `["projectedRulesHash"]` |
| identityHash v1 stored vs v2 live | **STALE** — `["identityHash"]` |

That is the 3.5 F1 fix behaving exactly as specified: absent-from-both is fresh, present-on-either-side compares strictly. **A stored dark build WOULD read stale the moment candidate mode expects the component** — there simply are no stored builds to be that build.

**⚠ THE NON-EMPTY FINDING — 47 of 80 battle-locked manifests are STALE against the live identity**, carrying `identityVersionAtLock: 1` and `identityHashAtLock: db5d95e8…` — **the v1 catalog-lock hash**, against live v2 / `4b44df0be6…`. These predate the PR 3.5 ladder repair that bumped ARCHETYPE_IDENTITY_VERSION 1 → 2. **This is expected and is NOT a defect, for a reason the runbook already states:** locked manifests make in-flight battles independent — the eval path performs no re-projection, `agentContext.activeRules` is frozen at creation, and the advisory admissibility gate compares the manifest/slice stamp pair WITHIN the battle doc, both halves stamped atomically by FC-1. **A stale-stamped battle stays internally consistent and renders its own generation's content to completion; it does not "serve" a current read.** Every one of the 80 is `completed` — **0 active** (the same fact that cleared the 1.10 hard gate), so none is mid-flight across the boundary. The reader direction that matters post-flip is the opposite one: **new battles for stale-stamped agents reject until redeploy**, which is FC-1's stamping guard, not this comparator.

**`shadowDiffs` (530) and `battleSettlements` (78) are historical records of completed ticks**, manifest-anchored by construction — `shadowAssemblyCapture` skips pre-manifest battles entirely, so no envelope-less record exists. They are not re-served on any future read path.

**Nothing serves.** No location holds an artifact that would be read as fresh and served under the candidate boundary: the one location whose freshness is gate-checked is empty, and every non-empty location is either historical-and-frozen or inert-until-repointed.

**VERIFY:** every stale location rejects/recompiles; none serves. **ROLLBACK POINT:** unchanged — stop is still free.

## Step 7 — WRITE THE ACTIVATION RECORD (the flip)

**`writeActivationRecord(db, { activeIdentityVersion: 3, boundaryStateVersion: 1, activeEpochId: <E1 — a FRESH epoch id>, candidateStateId: <runId>, semanticHash: <ratified> })`**

`activeEpochId` must be **fresh** — A49's history-wide check rejects any epoch id already in history, and **genesis holds E0 at generation 1**, so reusing the step-1 epoch aborts (proven row). One transaction: R6-B1 (descriptor vs candidate manifest) + M6 (exact entryCount, recomputed semantic hash, create-only ids, no stale extras) verify INSIDE it — any defect aborts with nothing repointed; the genesis ids are RESERVED and reject here. The writer mints generation MAX+1 — **the first real activation is generation 2** (Q1 ruling framing: boundaryStateVersion starts at **1**; `overrideRevision` at 0). Per-boundary states ride this record — no independent flag flips at the flip.

**7 RECORDED — 2026-08-20T00:28:53.238Z. THE FLIP IS DONE. IDENTITY v3 IS ACTIVE AT GENERATION 2.** *(Deliberately uncommitted, per the 1.2 block.)* No abort: the five in-transaction checks all passed and the descriptor repointed in one transaction.

**THE STORED DESCRIPTOR — independent re-read of `composition/activation`, verbatim:**

```json
{ "activeIdentityVersion": 3, "boundaryStateVersion": 1, "activeEpochId": "E1-20260820",
  "candidateStateId": "composition-migration-2026-08-19T23-59-09-930Z",
  "semanticHash": "1b76ddbe5a3687d583125d4e68c02e03322a7a6c67469e971366fed60ea52f26",
  "overrideRevision": 0, "recordedAt": null, "activationGeneration": 2 }
```

**ALL SEVEN DESCRIPTOR FIELDS VERIFIED** (`allSevenFieldsOk: true`) — `activeIdentityVersion` 3 ✓ · `boundaryStateVersion` 1 ✓ (the Q1 framing: starts at 1) · `activeEpochId` `E1-20260820` ✓ (FRESH — A49's history-wide check passed; `E0-20260819` is held by generation 1 and would have aborted) · `candidateStateId` the ratified runId ✓ · `semanticHash` the ratified value ✓ · `overrideRevision` 0 ✓ · `activationGeneration` 2 ✓. **The helper's return equalled the stored document across all seven fields** (`helperReturnMatchesStored: true`).

**GENERATION IS MAX+1, NOT A REUSE:** previous 1 → new **2**, `isMaxPlusOne: true`. The first real activation is generation 2, exactly as the F2 ruling frames it.

**THE FIVE IN-TRANSACTION CHECKS PASSED** — all inside the one transaction that repointed the record, so any failure would have aborted with nothing written: A49 epoch-reuse (history-wide + current tuple) · **R6-B1** descriptor `semanticHash` == candidate manifest's · §2-F3 target-version match (descriptor 3 == candidate `activeIdentityVersion` 3) · **M6** exact `entryCount` (20 found == 20 pinned), create-only injective ids (every doc id IS its own `entryKey`'s id), and recomputed semantic hash == stored. The reserved-genesis guard also passed — this write could not have minted the genesis sentinels.

**APPEND-ONLY HISTORY NOW HOLDS TWO GENERATIONS** (`count: 2`, ids `['1','2']`):

| Gen | identity | epoch | candidateStateId |
|---|---|---|---|
| **1** | 2 (live) | `E0-20260819` | `genesis` — **UNCHANGED, still the genesis tuple** (`gen1StillGenesis: true`) |
| **2** | **3** | `E1-20260820` | the ratified runId |

Generation 1 was not rewritten — `create()` makes that structurally impossible — so **`toGeneration: 1` has a complete, untouched prior tuple to restore.**

**UPDATE, NOT RECREATE — the shape confirmed rather than assumed:** `createTime` **HELD** at `2026-08-19T23:29:45.814Z` (the 1.8 genesis create) while `updateTime` **MOVED** to `2026-08-20T00:28:53.238Z`; `createNotEqualUpdate: true`. The record document is the same document, repointed — not deleted and reborn.

**THE LOADER — `{activated: true, genesis: false, generation: 2}`** with the **full 7-field descriptor** (`descriptorHasAllSevenFields: true`). **And the behavioural contrast against 1.8, measured with the same instrumented `fetchLayers`:** at genesis it reported **`fetchLayersCalled: false`** (base-only, zero layer reads); now it reports **`fetchLayersCalled: true` with 20 overlay entries loaded.** The overlay that has been inert since step 3 is now the resolved view — that single flag flipping is the flip, observed.

**EPOCH STATE AT THIS MOMENT, recorded so the intermediate is not misread as a defect:** the descriptor names `E1-20260820`, but the epoch doc is still closed on epoch id `E0-20260819` at fence generation 1, with `updateTime` unmoved at `23:42:49.557Z`. **That divergence is correct and expected** — step 8B is what transitions the epoch doc to `E1-20260820` in the `probe` state (minting incarnation 2). The fleet stays frozen behind the closed E0 epoch until then.

**ROLLBACK POSTURE — the guarantee is now TOTAL but no longer free.** Through 8A, THE ROLLBACK PROTOCOL with `toGeneration: 1` restores the genesis world exactly (live identity v2, base-only resolution, base-only compiles) because **no v3 base state exists anywhere** — nothing has been born, compiled or battled under v3. "Stop is free" stopped being true at this write: reversing now is the protocol, not a halt.

**VERIFY:** the loader returns `{activated: true, genesis: false, generation: 2}` with the full 7-field descriptor. **ROLLBACK POINT (scope per #1/#12):** THE ROLLBACK PROTOCOL (below), at any time; **`toGeneration: 1` restores the GENESIS world** — live identity, base-only resolution, base-only compiles (proven rows: rollback-to-genesis in the activation battery, base-only in the loader contract, birth parity in the birth-switch suite, the genesis-present pipeline row). While the fleet is frozen (through 8A) this restoration is TOTAL; from 8B on, the enumerated probe reconciliation applies (see the protocol's scope statement).

## Step 8A — CLOSED verification (everything provable WITHOUT writes; Sol review #6)

The epoch stays **closed**; the fleet is frozen; nothing here writes production state.

- **identityHash equality**: the served identity's hash equals the v3 snapshot's `identityHash` (catalog lock recompute — a read).
- **Loader checks**: `{activated: true, genesis: false, generation: 2}`, full descriptor, seqlock steady.
- **Stale-build rejection observed (read side)**: a pre-flip compiled build reads STALE through `diffSourceRevisionVector` (presence-aware compare) — verified via the gate's verify half without minting a recompile.
- **ACTION_COPY checkpoint:** founder reviews the user-facing product copy (identityMigration feed entries via `projectIdentityMigrationFeed` under A44 in preview, advisory sentences on rendered previews, renamed trait cards) — a copy defect here is a STOP-and-fix before 8B, not after.
- **M7 estimate check:** the chars/4 estimates recomputed against the v3 composition (the live-request measurement happens at 8B when a probe eval runs).

**8A RECORDED — 2026-08-20T00:37:15Z. SIX MECHANICAL CHECKS PASS; ONE OWED ITEM IS NOT SATISFIABLE HERE AND IS RE-FILED. ACTION_COPY SURFACED FOR THE FOUNDER.** *(Deliberately uncommitted, per the 1.2 block.)* Epoch closed, fleet frozen, **zero writes** — every check below is a read or a pure computation.

**(1) identityHash EQUALITY — PASS.** The activated identity is v3 = `CANDIDATE_IDENTITY_VERSION`; recomputed from HEAD via `computeCandidateIdentityHash()` = **`5cd3cca189cd0292e7d86787f1583868e0867b16ec93e8b3dcbbf2361d55be66`** = **the v3 catalog-lock value, equal.** The identity now served is the one the catalog locked.

**(2) ⚠ THE C ITEM OWED FROM 1.7 IS *NOT* SATISFIED — AND CANNOT BE AT THIS STEP. RE-FILED, NOT QUIETLY PASSED.** The hash check itself passes: v2 resolved through `getArchetypeDefinition(id, {identityVersion: 2})` recomputes to **`4b44df0be60866bc042fb4adce99281878256f13d74ae0ec02924ee4778d731e`** = the v2 catalog lock. **But the PROVENANCE is wrong for what this check exists to prove.** `getArchetypeDefinition` reads a bundled snapshot only for `identityVersion < ARCHETYPE_IDENTITY_VERSION` — **the CODE constant, which is still 2** (`archetypeVersionConstants.js:58`). Verified directly: `v2ResolutionIdenticalToLiveInCode: true`, `readFromBundledSnapshotFile: false`. **The record flip does not make v2 a prior version in the resolver's sense** — only a future code bump of `ARCHETYPE_IDENTITY_VERSION` to 3 does that. So the bundled-snapshot read the 1.7 finding wanted to exercise is **STILL unexercised**, and the F7 `includeFiles` guarantee still rests on the step-5 B1 build-configuration evidence (`filePathMap` in 187/187 bundles). **This is a correction to my own 1.7 framing** — I wrote that v2 "becomes a prior version and starts being read from the snapshot" after the flip; that was wrong, because the resolver keys off the code constant, not the record. **RE-FILED for PR 5** as part of the 1.7 gap: the C check is not deliverable by this activation event at all, and should be attached to the future identity-constant bump instead.

**(3) LOADER — PASS.** `{activated: true, genesis: false, generation: 2}`, **all seven descriptor fields present**, 20 overlay entries loaded, seqlock steady (one load, no torn-read retry).

**(4) STALE-BUILD REJECTION, READ SIDE — EMPTY, said plainly.** `collectionGroup('compiledBuilds')` holds **0 documents**. There is no stored pre-boundary build to read stale, so this check has nothing to exercise — **a true result, not a clearance**, exactly as recorded at step 6. The comparator's behaviour was driven directly at step 6 (all six presence-aware arms) and lives behaviourally in the PR 3.5 F1 rows.

**(5) NEGATIVE CHECKS — PASS, WITH A CONTROL.** Pure `compileBuild` resolution, zero writes:

| Pairing | cell state | verdict recorded | `blocked` | in `blockedControls` | absent from rendered prompt surface | absent from guardrail preview |
|---|---|---|---|---|---|---|
| `a-05 × degen` | **core_conflict** | `core_conflict` | **true** | yes | **yes** | **yes** |
| `f-12 × momentum_chaser` | **deferred** | `deferred` | **true** | yes | **yes** | **yes** |
| `a-06 × momentum_chaser` (CONTROL) | native | `native` | false | no | — | — |

**The control is what makes the two "absent" rows mean anything:** a `native` pairing IS processed and is NOT blocked, so the harness demonstrably records verdicts and does not blanket-block. **Both illegal pairings fail closed: recorded as blocked, excluded from rendering and from guardrail compilation.** *Correction recorded: my first probe passed `ruleMetadata: {}`, which makes the compile loop `continue` at `compileBuild.js:220` before any verdict — the rule was skipped entirely and the "absent" results were VACUOUS. The table above is the corrected run, with the metadata the loop requires and a control that proves non-vacuity.*

**(6) M7 ESTIMATE RECOMPUTE — PASS.** `composition.m7Budget.test.js` **3/3 green** at the activated composition: `EVAL_MAX_OUTPUT_TOKENS` 2048 pinned; the **maximal** system+identity request with advisories LIT on all 14 rules fits the named input budget; and the **advisory delta is bounded** — lit-minus-dark ≈ one sentence per tension rule, with a double-append at scale failing the row. Convention is chars/4 (the repo has no tokenizer by design), which **overstates** true BPE spend. **Scope boundary, restated from the fixture's own disclosure:** system prompt + identity message only — the live eval request's third message (prices/news/triggers/momentum) and the tool schema are NOT measured. **The live-request measurement is owed at 8B**, where a probe eval's `usage.input_tokens` is recorded.

**(7) ACTION_COPY — SURFACED FOR FOUNDER REVIEW. I do not approve it; the founder reads it.** `COMPOSITION_MIGRATION_FEED_ENABLED` is **false**, so `projectIdentityMigrationFeed` returns **0 entries** right now (A44: the flag flips only after the record is verified) — the copy below is stored and inert, and this is the moment to read it before it can ever surface.

**The 15 stored feed entries reduce to 9 distinct sentences:**

> 1. *"Adjusted tv-10 — fund_score moved to the nearest setting your archetype offers."*
> 2. *"Adjusted mb-01 — minutes moved to the nearest setting your archetype offers."*
> 3. *"Adjusted mb-11 — pct moved to the nearest setting your archetype offers."*
> 4. *"Adjusted tv-02 — action switched to a setting your archetype offers."*
> 5. *"Adjusted tech-macd-bullish — macdDirection switched to a setting your archetype offers."*
> 6. *"Adjusted tech-macd-bullish — rsiFloor moved to the nearest setting your archetype offers."*
> 7. *"Unequipped mb-03 — off-identity for your archetype under the new compatibility ruling."*
> 8. *"Unequipped tech-rsi-oversold — off-identity for your archetype under the new compatibility ruling."*
> 9. *"Unequipped t-11 — off-identity for your archetype under the new compatibility ruling."*

**Two things for the founder's eye specifically:** the copy names **raw rule ids** (`tv-10`, `mb-01`, `tech-rsi-oversold`) rather than display names, and it says *"your archetype"* — which reads correctly for the training-clone owners but is also what **Donny's owner** would see for his two clamps. **229 distinct advisory sentences** ride the candidate cells (sample recorded in the run artifact); they render on tension rules in the live prompt from the flip onward.

**ACTION_COPY RULING — 2026-08-20, founder. STOP-AND-FIX RAISED, DEFERRED TO PR 5 UNDER A NAMED GATE (option C). Option A refused (a code fix is a commit + deploy that VOIDS THE PIN with the record already at generation 2). Option B refused for the record: "patching stored entries hides the defect, regenerates on any re-apply, and costs a post-watermark write for nothing."**

**The defect:** the identityMigration feed copy names **RAW RULE IDS** (`tv-10`, `mb-03`, `tech-rsi-oversold`…) and **RAW PARAM NAMES** (`fund_score`, `macdDirection`…). Founder's standard: *"A user reading 'fund_score moved' learns as little as from 'tv-10'."*

**Why deferral is safe — the copy is UNREACHABLE, not merely gated.** `COMPOSITION_MIGRATION_FEED_ENABLED` is `false`, so `projectIdentityMigrationFeed` returns `[]` (verified: projector returned 0 entries). **And a grep across all of `api/` and `src/` finds ZERO call sites** for `projectIdentityMigrationFeed` or `feedEntries` outside the module itself — nothing renders this copy on any surface. It cannot reach a user in the interval.

> ## ⚠ NAMED GATE ON PR 5 / STEP 9 — NOT A PREFERENCE
> **`COMPOSITION_MIGRATION_FEED_ENABLED` MUST NOT FLIP until the headline + param-label substitution ships.** Until it ships, **the flag flip is BLOCKED.** The substitution is a one-line change at `ACTION_COPY` in `api/_utils/identityMigrationFeed.js` (the builders receive `{ruleId, param}` and must resolve display strings before formatting). Precedent for the exact pattern already in the tree: `ForgeScreen.jsx:265` — `otherTemplate?.headline || otherRuleId`.

**THE MAPPING, recorded so PR 5 does not re-derive it.** Source: `FORGE_RULE_TEMPLATES` (`src/data/forgeKnowledgeBase.js`). `headline` is the user-facing rule name on every Forge surface (`ForgeRuleCard.jsx:83`, `RuleDetailSheet.jsx:183`, `CategoryAccordion.jsx:61`, `DiscoverTab.jsx:116`, `CollectionDetailSheet.jsx:234`, `StarterKit.jsx:356`). **All 143 templates carry a usable `headline` — none invented, none missing:**

| rule id | display name (`headline`) |
|---|---|
| `tv-10` | Earnings + Technical Confluence |
| `mb-01` | Give your pick time to work |
| `mb-11` | Lean in for the final push |
| `tv-02` | MACD Histogram Acceleration |
| `tech-macd-bullish` | Ride momentum shifts |
| `mb-03` | Replace dead money |
| `tech-rsi-oversold` | Buy oversold stocks |
| `t-11` | Follow institutional accumulation |

**PARAM LABELS — IN SCOPE FOR THE SAME PR-5 FIX, and they exist.** Source: `forgeTemplates[].params[<name>].label`, which is exactly what the Forge renders (`ParamPicker.jsx:16`, `ParamSlider.jsx:24`, `CollectionDetailSheet.jsx:73` — the last using the same `label || key` fallback shape):

| rule id | param | label |
|---|---|---|
| `tv-10` | `fund_score` | Min fundamental score |
| `mb-01` | `minutes` | Minimum hold time |
| `mb-11` | `pct` | Hurdle reduction |
| `tv-02` | `action` | On deceleration |
| `tech-macd-bullish` | `macdDirection` | MACD momentum signal |
| `tech-macd-bullish` | `rsiFloor` | Minimum RSI for momentum |

**The corrected copy PR 5 should produce** (rule display name + param label, both substituted): *"Adjusted **Earnings + Technical Confluence** — **Min fundamental score** moved to the nearest setting your archetype offers."* · *"Unequipped **Buy oversold stocks** — off-identity for your archetype under the new compatibility ruling."* · and so on for the nine distinct sentences.

**`"your archetype"` STANDS** — founder ruling: accurate, and legible to the one real owner in the population.

**ROLLBACK REMAINS TOTAL.** No v3 base state exists anywhere: nothing has been born, compiled, battled or saved under v3 — `compiledBuilds` is empty fleet-wide, 0 active battles, and every 8A check above was a read or a pure computation. `toGeneration: 1` restores the genesis world exactly.

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

**General unfreeze (ONLY after every 8B check passes):** `transitionWriteEpoch(db, { state: 'open', epochId: 'E1' })` — probe→open RETAINS the incarnation (2; no intervening close, BL1) and removing the probe gate is what opens general traffic (clients capture the {epochId, fenceGeneration} tuple on their next formed mutation); lift the §6 freeze announcement; resume the EXTERNAL_ADMIN_WRITE_PATHS rows (each resume acknowledged); `COMPOSITION_MIGRATION_FEED_ENABLED` flips only after the record is verified (A44, flag-ownership table) — **AND NOT AT ALL UNTIL THE PR-5 COPY FIX SHIPS: see the ACTION_COPY NAMED GATE recorded at 8A. The copy names raw rule ids and raw param names; the flip is BLOCKED until the headline + param-label substitution lands. Do not flip it at this unfreeze.**; purge the lease registry (`purgeReleasedProvisionerLeases` — released-only, #3/F9):

```bash
node scripts/composition/lease-ops.js purge                            # DRY RUN — what would be deleted
node scripts/composition/lease-ops.js purge --operator "<you>" --apply # THE 8B CALL
```

Released leases only — an expired-but-unreleased (stuck) lease is **never** purged, because purging it would destroy the very signal the drain refuses on (#3). The report records the unreleased population either side of the delete as proof only released docs were touched.

**8B RECORDED — 2026-08-20T02:29:34Z → 02:44:06Z (window open 873 s / 14m 33s). TRANSITION AND GATE PASS; MOST PROBES NOT EXECUTED; ONE UNPLANNED WRITE ACCEPTED.** *(Deliberately uncommitted until PR 5, per the 1.2 block.)*

**PROBE IDENTITIES ENUMERATED (the step's own requirement):** `['Uy7u20M3wcbz1Dc5iZD4Yk9oTU63', 'cpu-18']` — the founder's Firebase auth uid, and the `ownerId` of `cpu-agent-18`. **Two different value shapes deliberately:** the rules layer compares `request.auth.uid` (`firestore.rules:42`) while the server chokepoint compares a threaded `actor` string (`compositionWriteEpoch.js:131`), and `decide.js` threads `agent.ownerId` (`:287`) rather than the caller's uid — so a CPU-agent deploy needs the literal `cpu-18`.

**(a) OPEN — PASS.** `transitionWriteEpoch(db, {state:'probe', epochId:'E1-20260820', probeIdentities:[…]})` returned `{state:'probe', epochId:'E1-20260820', fenceGeneration:2}` + the identity list; independent re-read identical. **Incarnation 2 MINTED** from 1 (closed→probe = a quiesced world becoming writable). `createTime` held — update, not recreate. **Every client token and server pin formed under incarnation 1 died here**, and both halves of the tuple moved (`E0-20260819`→`E1-20260820`, 1→2).

**(b) THE PROBE GATE — PASS, WITH BOTH NEGATIVE CONTROLS.** Zero-write transactional probes:

| actor | result |
|---|---|
| `Uy7u20M3wcbz1Dc5iZD4Yk9oTU63` | **ADMITTED** — `{probe, E1-20260820, fenceGeneration 2}` |
| `cpu-18` | **ADMITTED** |
| `some-other-uid` (unlisted) | **REJECTED** `probe_only` |
| `null` (unthreaded) | **REJECTED** `probe_only` |

The gate is CODE-ENFORCED, as the step claims: an unlisted actor and an actor-less writer both fail closed.

**(c) CLOSE — PASS.** `transitionWriteEpoch(db, {state:'open', epochId:'E1-20260820'})` → `{state:'open', epochId:'E1-20260820', fenceGeneration:2}`. **Incarnation RETAINED at 2** (probe→open, no intervening close — BL1). `probeIdentities` cleared by the write. The general unfreeze is done: the fleet is open.

**PROBES NOT EXECUTED — recorded as such, never as passed:**

| Probe | Status | Reason |
|---|---|---|
| 1 — probe birth | **NOT PERFORMABLE AS SPECIFIED** | Agent creation happens ONLY at profile creation in this product; there is no birth act available to an existing account. Also unavailable to the operator: creation is a client-SDK write under the `firestore.rules:224` create allowlist, with ZERO server-side creation path in `api/`. An Admin-SDK write would bypass both the probe gate and the BL2 provenance check and prove nothing. **The prepared cleanup script was NOT run** — it does not apply to any pre-existing agent. |
| 2, 3, 7 — deploy / battle+FC-1 / M7 live | **NOT EXECUTED** | The internal-caller door (`isInternalDeployCaller`, `decide.js:81`) needs `CRON_SECRET`; it is present but **EMPTY (`CRON_SECRET=""`) in `.env.vercel.production`, a scrubbed export**. Reported available from a presence check without verifying a value — an operator error, corrected here. |
| 4, 5 — `core_conflict` / `deferred` absent | **NOT EXECUTABLE FROM THE CLIENT** | Two independent blocks: the WS1 client guard pre-empts the write (`BundleBuildFlow.jsx:143-145` — "skip the doomed write", `RULE_COMPAT_MODE='enforce'`), and even past it `COMPOSITION_ENFORCEMENT_MODE='off'` means the composition boundary does not reject at the endpoint in this event. **A WS1 rejection must NOT be recorded as a composition one.** The compile-time behaviour IS proven — at 8A, by pure resolution, with a `native` control. |
| 6 — out-of-domain 409 | **NOT EXECUTED** | The founder could not locate `tv-10` in the UI. |

**⚠ UNPLANNED v3 BASE STATE — ACCEPTED (founder disposition).** During the open window the founder performed **two archetype changes** on `agents/XtuHDmqXgu9zGDIEtxui` ("1Agent", a real user agent created 2026-03-28): **→ analyst at 02:35:38.152Z**, then **→ guardian at 02:42:05.452Z**, before realising the window was live. **Both were the founder's; no other writer was involved.** Admitted because the uid was in `probeIdentities` — **the gate working correctly, not a fence failure.**

What landed: the agent doc (archetype, `equippedTraits` = guardian's v3 born-with set) plus **16 fresh rule docs** (`createTime == updateTime`), seeded through `selectIdentityVersion(descriptor)` → **3**, so genuinely v3-sourced. The agent now holds 192 rule docs / 103 trait-hosted / 14 distinct traitIds — the superseded analyst docs remain (`deleted: null`), see the filed item below.

**BL2 PROVENANCE — the stamp MOVED, by design, and my step-7 framing was too narrow.** The doc now carries `identityVersionAtBirth: 3` / `activationGenerationAtBirth: 2` on an agent five months old. `change-archetype.js:259` applies `birthProvenanceStamp(seedPin)` on every reseed — *"a re-birth stamps the version + generation its born-with content was seeded under."* By content that is correct: its born-with layer really was minted from v3. But I recorded at step 7 only the CLONE rule ("a re-sync preserves the existing clone's birth stamp"); **change-archetype is a THIRD path that restamps a long-lived agent**, and I did not flag it.

**CONSEQUENCE — ROLLBACK IS NO LONGER TOTAL.** The reconciliation query `agents where activationGenerationAtBirth >= <rolled-from generation>` now MATCHES `XtuHDmqXgu9zGDIEtxui`. The mechanism still holds (its v3 born-with docs would be deleted and reseeded at the restored version — correct, since they are v3 content), but **the 8A claim "no v3 base state exists anywhere" is superseded from 02:35:38Z.** Rollback is now **selector-total PLUS the named hand reconciliation for exactly one identity**, which is the protocol's own post-8B scope statement — arrived at through an unplanned act rather than a probe.

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

**⚠ PR-5 PRECONDITIONS — CARRIED FROM THE RUN. These are gates, not a wish list.**

1. **THE ACTION_COPY GATE (founder ruling, 2026-08-20).** `COMPOSITION_MIGRATION_FEED_ENABLED` **MUST NOT FLIP** until the headline + param-label substitution ships at `ACTION_COPY` in `api/_utils/identityMigrationFeed.js`. The full id→headline and param→label mapping is recorded in the 8A block — PR 5 does not need to re-derive it. Precedent pattern: `ForgeScreen.jsx:265`.
2. **THE FOUR WORDING/MECHANISM GAPS** found during the run, each to be corrected in the runbook text: **(a) 1.7** — the deployed-lambda snapshot smoke names a probe path that does not exist, and its "v2 via the bundled snapshot / v3 via the catalog" description does not match the resolver (only versions *below* the CODE constant read a file); **(b) step 2** — the literal `migration-scan.js` dry-run command cannot run against a closed fleet (`epoch_closed` at `:92`); the command of record is `--during-close`; **(c) E3** in `EXTERNAL_ADMIN_WRITE_PATHS.md` — claims a code backstop that is not armed until 1.9's close, because `assertWriteEpochOpen` fail-opens on an absent doc; **(d) step 5** — the candidate-pipeline tooling does not exist (no command for compile / verify-manifests / verify-shadow; both named "enable" flags are already true and not candidate-scoped).
3. **THE SWEEP-SCOPE FIX.** `compiledBuilds` is a SUBCOLLECTION (`agents/{id}/compiledBuilds/{mode}`); any sweep must read it as a **collection group**. The 1.11 and step-3 sweeps read it top-level only and were correct solely because the collection is empty. Both scripts were corrected mid-run, before step 6.
4. **THE `assertWriteEpochOpen` ASYMMETRY.** Post-activation, an absent epoch doc lets its callers through — background loops and `archetypeSeeding.js:142` — while transactional writers fail closed. Carried from 1.5 and confirmed by inspection; it wants a fix or an explicit accepted-risk ruling.
5. **NOT AN OWED ITEM — recorded so it is not mistaken for one.** The 1.7 "C" check (resolve v2 as a prior version through the deployed path) is **NOT DELIVERABLE BY THIS EVENT** and was **withdrawn**, not deferred: the resolver keys off `ARCHETYPE_IDENTITY_VERSION`, not the activation record, so no post-flip state turns v2 into a file read. F7's `includeFiles` guarantee rests on the **step-5 B1 configuration evidence** (`filePathMap` present in 187/187 function bundles). The check attaches to the FUTURE identity-constant bump. *(Founder: "carrying an undeliverable item forward is how it becomes assumed satisfied.")*

The `--apply` report, zero-residual output, preflight reports, watermark sweep, the filled RULES_DEPLOY_RECORD, the §10 observations, and this log → `docs/audits/` in a docs-only PR 5. The ledger's PR-4 rows move to CLOSED with their observations cited.

**LAST — one restoration commit, deployed** (founder rulings, Aug 12 and Aug 13). This runs after the general unfreeze of 8B, and after every other step-9 item: it is the only deliberate re-widening of the identity-write surface in this event, so it lands last and is logged with its own operator + timestamp row. It restores, in one commit:

- `CASUAL_CLONE_CONCURRENCY_ENABLED` → **true**;
- the two `vercel.json` cron entries removed at step −1 (`process-pending-reflections`, `agent-batch-review`) — **verbatim, from the JSON block recorded in step −1**; cron budget returns **37 → 39**.

  **Arithmetic corrected 2026-08-15 (founder ruling, step −1 VERIFY finding B).** This step was written as "35 → 37" when the removal took the registration 37 → 35. The mandate arc then registered two entries of its own in `e9459ebf` (`/api/cron/mandate-evaluate`, `/api/cron/mandate-rollover`), taking it back to **37 with the composition pair still removed** — confirmed against the DEPLOYED registration (`vercel crons ls` = 37 jobs, neither composition path present, 2026-08-15). Restoring the two entries therefore yields **39**, not 37. Against BUILD_RULES §6's assumed Pro ceiling of **40** this fits — there is no budget breach — but the margin is now 1 entry, not 3, so any further cron registration before step 9 must be checked against the ceiling rather than assumed free.

**Why the crons resume HERE and not at the 8B general unfreeze:** entry removal is a deploy-time mechanism, so restoring them is a commit, and step 1.2 forbids any commit or deploy from the ACTIVATION SHA pin onward. Everything else paused for the window — the `EXTERNAL_ADMIN_WRITE_PATHS` rows, the crons whose entries were never removed — still resumes at the 8B unfreeze; these two cannot, because their pause was structural rather than operational. Verify after deploy: both paths appear in the Vercel project's cron list, and `grep -c '"path"' vercel.json` returns **39** (corrected 2026-08-15 — see the arithmetic note above; the literal `37` here was the same stale figure).

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

**FREEZE CROSSED + RE-ASSERTED — 2026-08-15 (founder).** PRs #757, #758, #759 (mandate arc) merged after the 08-12 declaration with no lift logged. Recorded, not excused: the freeze protects step 1.2's SHA pin, and 1.2 had not run, so no pin was invalidated. Freeze RE-DECLARED from this entry: no merges to main until activation completes or I lift it in a logged act. Any further crossing re-opens step 0.

> **Completeness note appended by the step −1 VERIFY session, 2026-08-15 (not part of the founder's ruling text above; recorded because the ruling's own standard is "the log records the crossings rather than papering over them").** The ruling names three crossings; the full enumeration is **ten merges into `main` after the 2026-08-12 22:57 −0500 declaration**, listed here so the record is complete. The session that reported the three had examined only the range beyond its stale checkout and under-counted — the correction is the reason this note exists.
>
> | Merge | Committed | PR | Character |
> |---|---|---|---|
> | `07bd548a` | 08-13 00:02:40 −05 | #752 mandate lifecycle Phase 4 | unrelated arc |
> | `2acc6189` | 08-13 00:04:46 −05 | #753 runbook step −1 amendment | **this activation's own work** |
> | `7fe8c34e` | 08-13 01:05:47 −05 | #754 step −1 cron quiesce | **this activation's own work** |
> | `0332fd0c` | 08-13 01:19:42 −05 | #755 runbook criterion + freeze bump | **this activation's own work** |
> | `f06efbba` | 08-13 12:13:56 −05 | #756 B9 deploy record | **this activation's own work** |
> | `5103e834` | 08-13 14:16:33 −05 | #757 mandate substrate P5 | unrelated arc |
> | `9948ec2a` | 08-14 11:49:38 −05 | #758 mandate substrate P5 | unrelated arc |
> | `2f554469` | 08-14 13:21:54 −05 | #759 mandate flip1 substrate live | unrelated arc |
> | `b5fa74fe` | 08-15 13:08:20 −05 | #763 `WIRE_WRITES_ENABLED` false → true | unrelated arc |
> | `0308a9a8` | 08-15 13:09:23 −05 | #764 `EXA_RETRIEVAL_ENABLED` false → true | unrelated arc |
>
> Four of the ten (#753–#756) are step −1's own commits — the freeze-exception class the declaration itself anticipates ("every merge taken under a freeze exception moves the tip, including the merge that writes this line"), and the commit carrying this entry is a fifth of that class. Six are unrelated-arc merges and are the crossings the ruling addresses.
>
> **#763 / #764 landed roughly five minutes before the re-assertion was dictated**, so they fall under the original declaration rather than the re-declared one. Both were assessed against THE QUIESCE CRITERION before this entry was written: they gate the `fantasytimes/*` Wire writers, whose persistence target is `fantasyTimesWire` (`wireContracts.js:207`), and no `api/fantasytimes/*` handler touches `agents` / `rules` / `bundles` / `compiledBuilds` / `composition*` — **axis 1 (STORE) answers no, so no quiesce action is required and the step-1.11 sweep is unaffected.** `CASUAL_CLONE_CONCURRENCY_ENABLED` remains `false` at this tip (`featureFlags.js:237`), so step −1's bundle-probe verdict survives the flips.
>
> **Deploy state at the time of writing:** production is still `dpl_5dWDSHbJGTmmkGQ9pWjj2UHmJteS` (built from `2f554469`, created 08-14 13:21:59 −05). #763/#764 are **merged but not yet deployed**, so `main` is ahead of production by two commits — which step 0.1's deployed-SHA confirmation must account for.

**FREEZE CROSSED (SECOND TIME) + RE-ASSERTED — 2026-08-19 (founder).** Nine merges landed on `main` after the 2026-08-15 re-assertion with no lift logged and no exception logged. **Recorded, not excused** — the same treatment the 08-15 crossing received, and for the same reason: the freeze protects step 1.2's SHA pin, **1.2 had still not run, so again no pin was invalidated.** The full enumeration, so the record is complete rather than approximate:

| Merge | Committed | PR | Character | Logged? |
|---|---|---|---|---|
| `24145cf0` | 08-16 15:06 −05 | #770 swap-motive observability Tier 1 | unrelated arc | no |
| `91ad40b7` | 08-16 19:37 −05 | #771 step 1.1 flip + R1/S1/S2/S4 remediation | **this activation's own work** | no |
| `99b73916` | 08-16 21:21 −05 | #772 lease-ops tooling + `maxDuration` 10→60 | **activation-gating script** (exception class) | no |
| `63b39160` | 08-19 11:23 −05 | #773 exit-behavior Tier 2 Phase 0 verification (docs) | unrelated arc | no |
| `efc0f28b` | 08-19 12:29 −05 | #774 flag-pin reconcile + wire figure-quality belt | unrelated arc | no |
| `37b43887` | 08-19 14:15 −05 | #775 exit-behavior Ask 3 profitTarget (38 files) | unrelated arc | no |
| `6a13bf0d` | 08-19 14:38 −05 | #776 metric history snapshot substrate (dark) | unrelated arc | no |
| `8da5ed04` | 08-19 15:02 −05 | #777 flip `METRIC_HISTORY_SNAPSHOT_ENABLED` true | unrelated arc | no |
| `7c70ae6b` | 08-19 15:09 −05 | #778 BUILD_RULES EXA flag coupling (docs) | unrelated arc | no |

**Two of the nine (#771, #772) are the exception class the declaration names** — activation-runbook docs and activation-gating scripts — but the declaration says *"each logged,"* and neither was. An exception that is never written down is indistinguishable from a crossing by the next reader, which is the whole failure this log exists to prevent. Seven are unrelated-arc crossings.

**What the crossing actually cost, named rather than generalised:** three files on the activation's critical path moved after the last green 0.2 (`preflight-1dff1fa0f9dd.json`, 08-16 03:02Z, at SHA `1dff1fa0` — `main` has since taken 32 commits / 10 merges). **`api/cron/agent-evaluate.js` +425 / −6** across four commits — the SOLE battle-completer, the one step 1.10's hard drain gate waits on and the one the standing warning forbids pausing; **`api/_utils/compileBuild.js` +42 / −15**; **`api/_utils/shadowAssemblyCapture.js` +5 / −1** — both on the step-5 candidate path. Step 0 was therefore re-opened and **0.1 / 0.2 / 0.3 were re-run and re-recorded at `7c70ae6b`** (see the step-0 rows above; 5/5 suites green at harness exit 0, drainCount 0 over 360 battle docs, dark state observed). Two structural pauses were confirmed intact across the whole window: **`firestore.rules` untouched** since `f59e76f3`, so the B9 deploy record is undisturbed, and **`vercel.json` untouched** — `grep -c '"path"'` = 37 with neither `process-pending-reflections` nor `agent-batch-review` present, so step −1's cron quiesce still holds.

**FREEZE RE-DECLARED from this entry.** No merges to `main` until activation completes or I lift it in a logged act. Exceptions remain activation-runbook docs and activation-gating scripts — **and an exception is only an exception once it is logged HERE, in this file, in the same PR that takes it.** Any further crossing re-opens step 0 again. The commit carrying this entry is itself an exception of that class, logged by this sentence.

**THE PIN RULE, STATED PLAINLY (founder, 2026-08-19).** Step 1.2 re-pins THE ACTIVATION SHA at the final deployed SHA after the flip commits are live. **From the moment 1.2 pins, no commit and no deploy may land — if one does, step 1 re-opens from 1.1 and the pin is void.** Not "should not": the runbook has no mechanism that makes a post-pin commit safe, and the pin is the only thing that ties every subsequent step's evidence to one artifact. The freeze is real from the founder's merge of this commit forward, and the sequence is: merge this → wait for the deploy → **1.2 runs against THAT tip**, which becomes THE ACTIVATION SHA.

*(Re-review #9: STRICT order — −1 → 0 → 1 → … → 8A → 8B → 9. If THE ROLLBACK PROTOCOL is invoked at any point, append its own rows (R1–R8, one per protocol step) at the point of invocation — never overwrite a completed step's row.)*

| Step | Started | Result / counts | Verified by | Operator |
|---|---|---|---|---|
| −1 (rules deploy) | 2026-08-13 | **CLOSED** per the founder's state statement of 2026-08-19; the step −1 VERIFY findings are recorded inline in that section above (incl. the completeness note its VERIFY session appended). Two of its guarantees were independently re-observed on 08-19 and still hold: the `ensure-casual-clone` bundle probe (absent, with `api/agent/decide` present as control) and the cron quiesce (`vercel.json` untouched, 37 entries, neither composition path registered). | founder's statement + the step −1 section's own VERIFY text; the two 08-19 re-observations noted in the 0.3 row | founder |
| 0 (preflight + advisory drain) | 2026-08-15, **re-run 2026-08-19** | CLOSED at `1dff1fa0`; **RE-OPENED by the second freeze crossing and re-closed at `7c70ae6b`** — 0.1 equal, 0.2 `PASS` 5/5 green (exit 0), 0.3 drainCount 0 over 360 docs. Rows in the step-0 section above. | `preflight-7c70ae6be637.json` + the read-only drain/dark-state probes | founder |
| **1.1 only** (flip commits deployed) | 2026-08-16 15:54 −05 (branch) → **merged `91ad40b7` 19:37 −05** | **DONE, DEPLOYED.** `COMPOSITION_EPOCH_FENCE_ENABLED` → true (`compositionConfig.js:43`) and `COMPOSITION_COMPILED_IDENTITY_ENABLED` → true (`:83`), plus the review remediation carried in the same PR: **R1** lease clock (`7ce5f765` — HIGH, would have been activated by this flip), R3–R7, **S1/S2/S4** lease lifecycle (`5fd97a5b`), T1/T3 (`298654e2`). Deployment carrying the flip built `2026-08-17T00:37:11Z` from `91ad40b7`; both flags re-verified live in production `7c70ae6b` on 08-19. Behaviour-neutral on the day, as designed — no epoch doc ⇒ the fence fails open; no record ⇒ `resolveCandidateModeInTx` returns false. | `docs/audits/20260816_COMPOSITION_STEP_1_1_FLIP_REVIEW.md` (3 review passes, R1 mutation-checked, `vite build` green); dark state observed pre-flip and re-observed 08-19 | founder |
| **1.2** (preflight at the final deployed SHA → **THE ACTIVATION SHA pinned**) | 2026-08-19 17:13 −05 | **DONE. THE ACTIVATION SHA = `ca62b2b0f4236d2bc3bd93fcce7eab5d56d0f4b4`.** Deployed `dpl_6gtjoGDhQqVoxqSLB78L9p4sMskb` == `main` tip, equal, nothing else landed (range = 1 docs file, +49/−3). Preflight exit 0, `PASS`, 5/5 green — `preflight-ca62b2b0f423.json`. The 0.2 at `7c70ae6b` is SUPERSEDED as evidence; this run is the pin's. **No commit, no deploy from here.** Row is deliberately uncommitted — see the 1.2 block above. | `preflight-ca62b2b0f423.json` (`treeClean: true`) + the four-condition pre-pin check | founder |
| **1.3** (old-deployment-invocation drain) | 2026-08-19 17:17 −05 | **DONE. Waited 314 s ≥ the 300 s `maxDuration` ceiling**, measured from SERVING (`22:12:39Z`, the later of the two bounds, chosen deliberately) rather than build completion. No deployment landed during the wait; pin re-verified intact at the close. Row deliberately uncommitted. | direct observation of the apex alias + `maxDuration` census across `api/` | founder |
| **1.4** (B9 re-verification) | 2026-08-19 17:18 −05 | **DONE. B9 GATE: PASS** (exit 0) at the activation SHA. `deployedRulesSha` == `smoke.rulesTextSha256` == sha256(`firestore.rules`@`ca62b2b0`) == `7bd361d8…`. Row deliberately uncommitted. | `check-rules-deploy-gate.js` + the explicit three-way sha equality | founder |
| **1.5** (pause + positively acknowledge every external admin writer) | 2026-08-19T22:26:08Z | **DONE. All six rows acknowledged** — E1/E2/E3/E6 PAUSED, E4 not-paused-by-design, E5 satisfied by the 1.2 evidence; operator Flash, per-row mechanism recorded verbatim in the 1.5 block. No epoch-state write precedes the last ack (`writeEpoch` still absent). **E3 correction filed for PR 5**; the `assertWriteEpochOpen` absent-doc asymmetry carried onto the 1.9 checklist. Row deliberately uncommitted. | founder's per-row sign-off + code inspection of `assertWriteEpochOpen` | founder (Flash) |
| **1.6** (open the epoch explicitly) | 2026-08-19T22:31:19Z | **DONE. THE FIRST WRITE OF THE RUN.** `transitionWriteEpoch(db, {state:'open', epochId:'E0-20260819'})` → `{state:'open', epochId:'E0-20260819', fenceGeneration:1}`, confirmed by an INDEPENDENT read-back (field-by-field match, no divergences; createTime == updateTime == 22:31:19.466Z). Doc was absent pre-write, so incarnation 1 is a true first incarnation. Row deliberately uncommitted. | helper return + independent `.get()` read-back + field compare | founder (Flash) |
| **1.7** (snapshot smoke — **SUBSTITUTED SCOPE**) | 2026-08-19T22:44Z | **DONE, B1 + B2 both PASS; genesis not blocked.** **FINDING: the step as written is unexecutable** — no deployed path resolves the version-parameterized resolver or returns an identityHash (all 189 endpoints checked); same class as R2. **B1:** `includeFiles` resolves all three snapshots into **187/187** function bundles (`filePathMap`), destination matching the runtime path. **B2:** v1 — the only version that reads a file today — resolves through the real path to `db5d95e8…`, equal to the catalog lock, with non-vacuity (v1 ≠ live) and fail-loud (v99 → null) controls. **Limitation:** verifies build config + the file-reading path, NOT the running lambda's filesystem. **C owed at 8A.** Wording defect filed for PR 5. Row deliberately uncommitted. | local `vercel build` at the pin + real-path v1 resolution with two controls | founder (Flash) |
| **1.8** (GENESIS — generation 1) | 2026-08-19T23:29:45Z | **DONE. GENESIS WRITTEN.** `writeGenesisDescriptor(db,{activeEpochId:'E0-20260819'})` → generation 1, all seven fields verified field-by-field on an independent re-read; sentinel pair intact; createTime == updateTime; history doc `1` created (rollback-to-genesis available from here). **Post-checks all pass:** F5 gate armed and fence flag verified true at the deployed SHA; L1-1 client read resolves (rules clause + record exists; unauthenticated control 403); loader `{activated, genesis, generation 1}` with **`fetchLayersCalled: false`** — zero layer reads — and base passthrough byte-equal; births select LIVE v2 with definitions identical to live; **epoch doc unchanged (fenceGeneration 1, updateTime still the 1.6 value)**. Row deliberately uncommitted. | independent read-back + instrumented loader + rules probe | founder (Flash) |
| **1.9** (close + drain — **THE WATERMARK**) | 2026-08-19T23:42:49.557Z | **DONE. EPOCH CLOSED.** closing 23:42:20.663Z → drain dry `WOULD_DRAIN_IMMEDIATELY` → drain live `{drained:true}` (538ms, 1 poll, no stuck holder) → closed. **`fenceGeneration` retained at 1 throughout**; doc UPDATED not recreated (createTime still the 1.6 value). **WATERMARK = `2026-08-19T23:42:49.557Z`** — 1.11 keys off it. **Empty-set caveat recorded:** `{drained:true}` over 0 docs is a true result, not behavioural evidence; that lives in `compositionLeaseOps.test.js`'s closed-epoch block. **Carried `assertWriteEpochOpen` item SATISFIED** (doc exists + closed). **Fence proven live:** both `assertWriteEpochOpen` and `validateWriteEpochInTx` reject `epoch_closed`, zero writes queued; lease-acquisition probe deliberately declined. Row deliberately uncommitted. | helper returns + independent re-reads + two zero-write fence probes + aftermath read | founder (Flash) |
| **1.10** (battle-drain HARD GATE, post-watermark) | 2026-08-19T23:47:00Z | **DONE. GATE CLEARS — drainCount 0.** Non-vacuous: 360 `agentBattles` read, histogram 360 `completed` / 0 `active` / 0 missing the field, stamp census `activeMissingStamps: 0`. `agent-evaluate` stayed scheduled throughout. Row deliberately uncommitted. | post-watermark predicate re-run with histogram + stamp census | founder (Flash) |
| **1.11** (watermark sweep — **STEP 1 COMPLETE**) | 2026-08-19T23:47:44Z | **DONE. ZERO UNATTRIBUTABLE WRITES.** 1,432 protected-store docs scanned in full (agents 62 · CG:rules 1,253 · CG:bundles 115 · composition 2 · 4 empty collections). **1 hit: `composition/writeEpoch` at +0 ms — the watermark write itself, step 1.9(d).** Sweep proven live (newest doc below the boundary = the 1.8 genesis write). Predicted `agent-evaluate` split did not arise — 0 active battles, so nothing to complete; recorded as unexercised, not confirmed. Row deliberately uncommitted. | full-corpus `updateTime` sweep incl. collection groups | founder (Flash) |
| **STEP 1 CLOSED** | 2026-08-19T23:47:44Z | THE ACTIVATION SHA `ca62b2b0` pinned · epoch `E0-20260819` CLOSED at incarnation 1 · GENESIS generation 1 written · fence proven live · watermark clean. **Next: step 2 FINAL-DRYRUN — the founder's ratification of the exact counts. The A7-LOCK freeze comes into force there.** | | |
| **2** (FINAL-DRYRUN — **RATIFIED**) | 2026-08-19 (dry runs 23:50:27Z / 23:50:48Z) | **RATIFIED BY THE FOUNDER.** 62 scanned · 6 affected · 20 entries · clamp 13 / replace 3 / unequip 4 · **semanticHash `1b76ddbe…`** · needsBinding **0** · residuals **empty** · activeIdentityVersion 3. M12 satisfied (semanticHash equal, runHash differs). **Donny (`F3WIPUHnLzLA22l7atLV`) ratified knowingly** — clamps not unequips; corrected population framing (5 training clones + 1 real user agent) adopted, not inherited. **Command of record: `--during-close`** (the literal form cannot run against a closed fleet — observed `epoch_closed` at `:92`); filed as the 3rd PR-5 wording gap. **A7-LOCK in force**, `ACTIVATION_EVIDENCE.json` unmoved (sha256 `ad2875a7…`, 3/3 green). Row deliberately uncommitted. | two dry-run reports + a7lock suite + evidence-file sha | founder (Flash) |
| **3** (`--apply --during-close`) | 2026-08-19T23:59:23Z | **DONE. OVERLAY WRITTEN — CANDIDATE NAMESPACE ONLY.** runId **`composition-migration-2026-08-19T23-59-09-930Z`** (the future `candidateStateId`). All 7 VERIFY checks pass: semanticHash `1b76ddbe…` in the summary AND on the stored run doc == ratified · 20 entry docs present · byAction recounted from stored docs (13/3/4) · 6 affected ids exact match · **create-only on all 20** (createTime == updateTime, injective ids) · **base untouched: full 1,432-doc before/after diff, `changedCount: 0`, sole addition is the run doc** — Donny's two rule docs still at their June `updateTime` · **record still genesis**, does not point at the runId. Row deliberately uncommitted. | pre/post protected-store snapshot diff + independent namespace read | founder (Flash) |
| **4** (zero-residual verify) | 2026-08-20T00:08:01Z | **DONE. ZERO RESIDUALS, FULL FLEET.** All 62 agents resolved through `resolveEffectiveConfig` over base + the STORED overlay (read from Firestore, not re-planned): `TOTAL_RESIDUALS_OVERLAY: 0`, `agentsWithAnyResidual: []`, `dangling: []` on every affected agent, provenance count == entries applied on all six. **Donny observed: fund_score 65→**71**, minutes 90→**60**, both `provenance: overlay`, residuals 0** — the ratification settled by observation. **Non-vacuity: base-only 16 residuals vs overlay 0** — the resolver demonstrably consulted the overlay. Overlay source verified as the ratified runId (only candidate state present; all 20 entries stamped with it). Row deliberately uncommitted. | dual-resolution contrast + independent overlay read | founder (Flash) |
| **5** (candidate pipeline — **SCOPE SUBSTITUTED**) | 2026-08-20T00:14Z | **B PASS; C owed at 8B; A refused.** **FINDING: the stage's tooling does not exist** — no command for compile/verify-manifests/verify-shadow; both "enable" flags already true and not candidate-scoped (so no commit, pin safe); every productive stage writes outside the candidate namespace. **B:** explicit `candidateMode` resolution, zero writes — candidate build carries `sourceRevisionVector.projectedRulesHash` (Donny `e093f5ba…`, clone `d23816ea…`), live build omits the key; contentHash differs; `buildsDiffer: true` both agents; validation entries `metadata_missing`/`compat_cell_missing` expected per §II (no gate-green claimed). Confirmed zero writes landed (compiledBuilds CG = 0; epoch + record updateTimes unmoved). **Does NOT evidence stored manifests or shadow captures.** **Sweep blind spot found + fixed before step 6:** `compiledBuilds` is a subcollection; prior sweeps read it top-level only — CG check confirms 0 docs so 1.11 and step 3 stand, now correct by construction. 4th PR-5 gap filed. Row deliberately uncommitted. | in-memory dual resolution + post-run zero-write reads | founder (Flash) |
| **6** (stale-artifact sweep) | 2026-08-20T00:23:36Z | **DONE — MIXED, stated plainly.** `compiledBuilds` (the ONLY location `diffSourceRevisionVector` reads) is **EMPTY (0, swept as a collection group)** — so "every stale artifact rejects" is **VACUOUSLY true, a true result not a clearance**; behavioural evidence lives in the PR 3.5 F1 comparator rows + `deployBuildValidation.test.js`. **Comparator driven directly instead** (pure, zero writes): absent/absent fresh · stored-absent-boundary-expects **STALE** · both-present-differ **STALE** · equal fresh · candidate→legacy **STALE** · identityHash v1-vs-v2 **STALE**. **Non-empty finding: 47 of 80 battle manifests stale at `identityVersionAtLock: 1` / `db5d95e8…`** — expected (pre-PR-3.5), all `completed`, 0 active; locked manifests are internally consistent and do not serve. shadowDiffs 530 + battleSettlements 78 historical/manifest-anchored; candidate state 1, inert at genesis. **Nothing serves.** Row deliberately uncommitted. | corrected collection-group sweep + direct comparator drive | founder (Flash) |
| **7** (**THE FLIP** — generation 2) | 2026-08-20T00:28:53.238Z | **DONE. IDENTITY v3 ACTIVE.** `writeActivationRecord` → generation **2**, all seven fields verified on an independent re-read, helper return == stored. Epoch `E1-20260820` **fresh** (A49 passed). All five in-tx checks passed (A49 · R6-B1 semanticHash · F3 target-version · M6 count/ids/recomputed-hash). History now `['1','2']`, **gen 1 genesis UNCHANGED** — rollback-to-genesis has a complete prior tuple. **Update not recreate:** createTime held at the 1.8 value, updateTime moved. **Loader `{activated:true, genesis:false, generation:2}`**, full 7-field descriptor, and `fetchLayersCalled` **true with 20 overlay entries** (vs `false` at genesis) — the flip observed behaviourally. Epoch doc still E0/closed until 8B (expected). Row deliberately uncommitted. | independent re-read + history read + instrumented loader contrast | founder (Flash) |
| **8A** (closed read-only verification) | 2026-08-20T00:37:15Z | **6 checks PASS, 1 owed item RE-FILED, copy surfaced. Zero writes.** (1) identityHash == v3 lock `5cd3cca1…` ✓ (2) **⚠ the 1.7 C item is NOT satisfiable here** — v2 hash matches `4b44df0b…` but resolves IN-CODE, not from the bundled file, because the resolver keys off `ARCHETYPE_IDENTITY_VERSION` (still 2), not the record; my 1.7 framing was wrong and is corrected + re-filed (3) loader `{activated,genesis:false,generation:2}`, 7 fields, seqlock steady ✓ (4) stale-build read side **EMPTY** — true result, not a clearance (5) core_conflict + deferred both processed, **blocked:true**, absent from prompt surface + guardrail preview, with a `native` control proving non-vacuity (first probe was vacuous — corrected) (6) M7 3/3 green, advisory delta bounded; live-request measurement owed at 8B (7) **ACTION_COPY: STOP-AND-FIX RAISED → DEFERRED TO PR 5 UNDER A NAMED GATE** — copy names raw rule ids AND raw param names; display names exist for all 8 (`headline`) and labels for all 6 params, both recorded in the 8A block; **`COMPOSITION_MIGRATION_FEED_ENABLED` MUST NOT FLIP until the substitution ships** (also written into the 8B unfreeze line and the step-9 preconditions). Copy is UNREACHABLE meanwhile — flag false AND zero call sites render it. Option A refused (voids the pin), option B refused on the record. `"your archetype"` stands. **Rollback still TOTAL.** Row deliberately uncommitted. | pure resolution + reads + M7 suite | founder (Flash) |
| **8B** (probe-gated verification; **probe ids: `Uy7u20M3wcbz1Dc5iZD4Yk9oTU63`, `cpu-18`**) | 2026-08-20T02:29:34Z → 02:44:06Z (873 s) | **TRANSITION + GATE PASS; MOST PROBES NOT EXECUTED; ONE UNPLANNED WRITE ACCEPTED.** probe open → **incarnation 2 minted**; gate verified with 2 positive + 2 negative controls (`probe_only`); probe→open close **retained incarnation 2**, fleet now OPEN on `E1-20260820`. **NOT EXECUTED:** probe 1 (birth is profile-creation-only + client-SDK; cleanup script NOT run), 2/3/7 (`CRON_SECRET` empty in the scrubbed export), 4/5 (WS1 pre-block + enforcement off — not a composition rejection), 6 (rule not locatable in UI). **UNPLANNED v3 BASE STATE ACCEPTED:** founder's two archetype changes on `XtuHDmqXgu9zGDIEtxui` inside the window (analyst 02:35, guardian 02:42) — gate admitted correctly; 16 v3 rule docs + BL2 restamp `identityVersionAtBirth 3 / activationGenerationAtBirth 2`. **Rollback is no longer TOTAL — selector-total plus reconciliation for that one identity.** | helper returns + independent re-reads + zero-write gate probes + post-hoc doc assessment | founder (Flash) |
| **8B general unfreeze** | 2026-08-20T02:44:06Z | Fleet OPEN on `E1-20260820` at incarnation 2. **`COMPOSITION_MIGRATION_FEED_ENABLED` NOT flipped — blocked by the ACTION_COPY gate (8A).** Lease purge not run (registry empty — 0 docs). | | founder (Flash) |
| 9 (docs closeout) | | | | |
| R1–R8 (rollback protocol, if invoked — appended per step) | | | | |
