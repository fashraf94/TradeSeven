# Composition PR 4 — BUILD_RULES §2 Adversarial Review Record

**Date:** Aug 7, 2026 · **Branch:** `claude/composition-pr4-identity-event` (cut from `origin/main` @ `3c396b14`; `git fetch origin` at session open per §3) · **Scope:** the cumulative PR-4 diff — the activation record service (7-field descriptor per the Aug-7 rulings), B2 provisioner leases, the candidate default-traits object + v3 registry catalog + version-parameterized resolver, the §7-signed fenced work (decide.js projection splice, FC-1-CLOSE, manifest shape), the B1/B3-EXT/B8-FINAL/A7-LOCK/M7-E2E/BARE-CELL-INVARIANT ledger rows, the D14/D15 flip obligations, and the ACTIVATION_RUNBOOK. ~56 files / ~18.4k insertions — threshold hit; review mandatory.

**Process:** `/code-review` at high effort produced the primary single-pass findings (its §2 disclosure noted no fan-out in that context); the adversarial requirements were then met in-session: **two independent verification agents** (one instructed to REFUTE every finding against the fixed tree; one running fresh lenses — dark-guarantee + test-integrity — over the diff), a **six-mutation kill pass**, the **full vitest suite**, the **rules emulator suite**, and an explicit **`vite build`**.

## Fence sweep (§1)

Three fenced-file contacts, all under the ONE §7 sign-off the founder's PR-4 tasking authorizes (items B4–B6): `api/agent/decide.js` (the REVERSED-ruling projection splice — pin + guarded write + the F1 catch fix + the L2-3 pin threading into both battle call sites; net ~20 lines), `api/_utils/agentBattleService.js` (FC-1: threaded-or-self pin → stamp → commit-revalidate; 4 contact points), `api/_utils/agentEvalPromptAssembly.js` (the manifest half of the stamp pair passed into the advisory gate; 1 call-site edit). Concept-fence: the battle-doc manifest shape change rides `resolvedAgentManifest.js` (generationStamp carriage, absent ⇒ byte-identical incl. manifestHash). The flag-split prose rule: no NEW render module (compositionAdvisoryRender was registered at PR 3); the honesty sweep is green. p4 goldens byte-green throughout.

## CONFIRMED findings — fixed in-branch

| # | Finding | Fix |
|---|---|---|
| F1 | **The splice's rejections were swallowed:** decide.js's pre-existing "never blocks deploy" catch ate `ProjectionStaleError`/`EpochClosedError` — a cross-generation deploy would log and continue with N−1 inputs (Sol's counterexample re-enabled), and a closed-epoch deploy would proceed to battle creation | The catch now classifies: fence codes (`projection_stale_generation`, `epoch_closed`) reset `deployingAt` and 409; fail-open remains only for projection COMPUTATION failures (the pre-PR-4 contract) |
| F3 | **A typo'd `activeIdentityVersion` could ratify an incoherent record** (live-version + candidate overlay, or an unresolvable version failing every birth closed) — M6/R6-B1 never bound the version | `verifyCandidateInTx` now aborts on `run.activeIdentityVersion ≠ descriptor.activeIdentityVersion` (`activation_identity_version_mismatch`); regression row added |
| F4 | **Epoch reuse checked only the CURRENT tuple:** re-activating an OLDER generation's epoch id would silently resurrect its abandoned overrides (the A49 class) | The writer rejects an epoch id appearing at ANY history generation (in-tx history read); rollback's deliberate whole-tuple prior-epoch restore is unaffected; regression row added |
| F6 | **The casual-clone RE-SYNC write phase had no lease-currency check** (census claimed per-phase checks; this branch had none) | `assertLeaseCurrent` before the subcollection copy AND before the doc update in the re-sync branch |
| F8 | **Lease-id collision:** `${holder}-${ms}` — the contemplated same-user double-tap within one ms would share a doc; one release could un-cover a live provisioner | Random suffix (`randomUUID().slice(0,8)`) |
| F9 | **Unbounded lease-registry growth** (release marks, never deletes; drain full-scans) | `purgeReleasedProvisionerLeases` (releases + long-expired only) + a runbook unfreeze step; the keep-on-release drain-race rationale preserved during the window |
| F7 | **Vercel snapshot bundling (PLAUSIBLE→mitigated):** the catalog's prior-version resolution reads `docs/registry-snapshots/*.json` at runtime; nothing guaranteed the serverless bundle carries them | `vercel.json` `functions.includeFiles: docs/registry-snapshots/**`. **Unverifiable at merge** (no preview crons/deploy from CI) — named as a runbook step-0 verification |

## CONFIRMED — disclosed, not code-fixed (founder decision points)

| # | Finding | Disposition |
|---|---|---|
| F2 | **The FIRST activation cannot be rolled back** — no prior history generation exists; deleting the record would re-mint generation 1 (tuple reuse, the B1-EXT/ABA class); a live-version-pointing descriptor needs unwritten overlay-non-participation semantics | **UNWRITTEN design point → disclosed in the runbook at step 7 as requiring a founder ruling BEFORE the live run** (the model note forbids deciding it here). Until ruled, step 7 of the first run is the point of no return; §10 defects are fix-forward |
| F5 | **Fence-flag lowering post-activation splits identity selection** (server pins gate on the flag; the client record read does not) — in tension with A48's no-flag posture | Codified as a LOAD-BEARING invariant: compositionConfig docstring + the runbook standing rule ("once step 7 has run, the flag NEVER lowers; deactivation is rollbackActivationRecord, nothing else"). A code-level guard was rejected: any record probe while dark violates the A23 zero-I/O contract; the flag is a PR-reviewed constant, and the flip commit's own pins (step 1) make a lowering PR loud |

## Verification-agent verdicts

**Pass 1 — the REFUTATION agent** (instructed to refute every finding against the fixed tree; md5-verified its own mutation restores):

| Finding | Verdict | Note |
|---|---|---|
| F1 | CONFIRMED-FIXED | Both fence codes 409 with the lock cleared, BEFORE the fail-open arm; the tournament fork sits after the splice so it is covered; downstream FC-1 throws surface as loud 500s (untyped but never swallowed). Gap it flagged: NO test caught a revert of the catch fix → a static source-guard row (the decide.auth.test.js pattern) was ADDED in response |
| F2 | CONFIRMED-FIXED (disclosure accurate) | Delete-then-reactivate would hard-fail on the history create rather than silently reuse — the ruling demand stands either way |
| F3 | CONFIRMED-FIXED | Regression row mutation-verified (1 failed/20 passed under the severed check). Residual: a version-LESS (pre-rename) run doc skips the equality — process-covered (FINAL-DRYRUN re-stamps; semanticHash + M6 still bind); recorded, not code-forced |
| F4 | CONFIRMED-FIXED | In-tx history read; rollback's prior-epoch restore unaffected and asserted; regression row discriminates the fix (the reused epoch is non-current at the attempt). Whole-history read grows with generations — negligible at runbook cadence |
| F5 | CONFIRMED-FIXED (docs = the honest runtime maximum) | A runtime guard is genuinely precluded by A23 (every helper returns pre-read while dark; no always-on record read exists). Its suggested supplement — a named manual gate in the preflight — was ADDED in response |
| F6 | **CONFIRMED-OPEN (half-present) → completed in response** | The pre-copy currency check in the re-sync branch had silently no-opped (a replace-miss); it is now present — copy-phase checks before AND after, parity with the create path. The mid-copy TTL-straddle window remains the disclosed bounded-conformance limit (B8 watermark = backstop) |
| F7 | CONFIRMED-FIXED (offline part) | Config shape valid for non-Next functions; what remains unverifiable at merge: the builder actually copying the directory at the path layout the lambda expects — named as a runbook step-0/preview smoke |
| F8 | CONFIRMED-FIXED | No test pins the exact id; 51 affected tests green |
| F9 | CONFIRMED-FIXED | Purge cannot reach an ACTIVE lease at any non-negative grace; the unguarded negative-grace input it flagged is now CLAMPED |

**Response fixes applied post-verdict:** the F6 pre-copy check, the F1 static source-guard row, the F5 preflight manual gate, the F9 grace clamp.

**Pass 2 — the FRESH-LENS agent** (dark-guarantee + test-integrity lenses over the full diff; its five mutation claims were live-run and byte-verified restored). Nine findings, **all confirmed and all dispositioned in-branch**; the fixes' own kill-verification re-ran each of its surviving mutations against the strengthened tree — every one now killed, originals md5-restored:

| # | Finding (agent-verified) | Disposition |
|---|---|---|
| L1-1 | **The client birth path reads Firestore unconditionally** — `seedDefaultTraits` awaits the record read with no gate and no timeout; between merge and the B9-gated rules deploy every agent creation issues one DENIED round trip (writes stay byte-identical; latency is unbounded on a degraded connection) | **Bounded + disclosed.** The read is TIME-BOXED (`RECORD_READ_TIMEOUT_MS` = 1.5 s race; timeout = failure = LIVE, the A24 fail-safe) and the module now carries a COST DISCLOSURE naming the denied-read window. The read itself is the written design (A48: the record is the only selector; the client has no flag) — gating it client-side would be a NEW design decision, so it is surfaced in the STOP report for the founder instead of decided here |
| L2-1 | **"Zero reads" was unfalsifiable** — the fixture logged writes only; the agent's dark-read mutation passed every dark row | The fixture now logs reads channel-tagged (`get` vs `tx.get`); the fence + lease dark rows assert `readLog` empty; a dark `createAgentBattle` zero-composition-reads row added. Mutation re-run: **2 failures** |
| L2-2 | **The derived-write census was satisfiable by the import statement alone** — the agent deleted the decide.js splice (import kept) and the census passed, contradicting its own header | Census rows now carry `callTokens` (verbatim call sites), `order` (pin-before-commit), and `forbidden` (the raw pre-splice write shapes) legs — the writer-census precedent's call-shape/position discipline; a meta-guard fails if the two chokepoint rows ever lose those legs. Mutation re-run: **census fails** |
| L2-3 | **FC-1's pin was taken AFTER `ensureDeployableCompiledBuild`** — an activation landing in the build-gate window produced a cross-generation battle doc whose stamp halves AGREE (the reader gate waves it through); no test drove that window | The decide.js flow pin (taken before the projection AND the build gate) is now THREADED into both `createAgentBattle` call sites (`options.activationPin`; self-pin fallback for other callers) — commit-time re-validation covers the whole flow. Fenced-diff delta: 2 option lines + 1 param thread in decide.js, 1 line in agentBattleService.js, same §7 sign-off. New behavioral row (threaded pin + interleaved flip → `CutoverInterleavedError`, nothing created) + a static source guard (pin-before-gate ordering, both call sites threaded). Mutation re-run (pin un-threaded): **2 failures** |
| L2-4 | **A silently dropped candidate seed rule passed the birth suite** (the agent skipped `r-07`; 16/16 green while every candidate diversifier would be born with half a trait) | The suite now derives the COMPLETE expected seed (every ruleId of every default trait → deterministic doc keys) from the library and asserts full equality + `rulesAdded`, live and candidate sides. Mutation re-run: **1 failure** |
| L2-5 | **The agentRef fake's auto-id fallback hid candidate doc-id defects** (`doc(undefined)` minted ids; production throws) | The fake now throws on a non-string id (admin-SDK parity) and the full-equality assertions above pin the exact deterministic doc keys |
| L2-6 | **M6's in-transaction property was unfalsifiable** — the fixture's `tx.get` delegated to plain `get`; hoisting every verification read out of the tx passed 21/21 | Fixture read channels (above) + a new row asserting every read of the activation write is `tx.get`-channel (candidate run doc + entries + record + history; zero non-tx reads). Mutation re-run: **1 failure** |
| L2-7 | **`acquireProvisionerLease` lacked B1's post-activation absent-doc fail-closed** — post-activation with the epoch doc missing, every fenced endpoint 409s while the provisioners run UNFENCED; a test row pinned the divergence as "parity" | The acquisition transaction now reads the activation record when the epoch doc is absent and FAILS CLOSED if it exists (mirroring `validateWriteEpochInTx`); the stale parity row re-titled to its true scope (pre-activation) and a record-present+absent-doc rejection row added. Mutation re-run: **1 failure** |
| L2-8 | **The a7lock probe floor was leg-blind** — disabling the entire boundary-probe generator passed (475 defaults clear the aggregate floor); the "exclusions stay visible" comment was inverted (they eroded the floor invisibly) | Per-leg tallies with EXACT pins at the frozen corpus (defaults 475, boundary 130, seeded 111, exclusions asserted 0 — currently structurally dead, loud if it ever fires); the aggregate becomes the sum. Mutation re-run: **1 failure** |

The agent also verified clean (stated per its instruction): every server dark seam byte-identical with zero reads (decide.js, createAgentBattle, both provisioners, `resolveSeedSource`, the registry catalog's lazy snapshot loads, the advisory gate), the F1 409 arm unreachable dark, the M6 rows order-independent and non-vacuous on write-leakage, and the drain test non-circular.

## Mutation record (all killed, originals restored byte-exact)

| # | Mutation | Killed by |
|---|---|---|
| T1 | Activation writer generation reuse (`+1` dropped) | 3 failures (monotonicity, first-activation, rollback rows) |
| T2 | Lease acquisition's epoch-state check severed | 2 failures (closed/closing rejection rows) |
| T3 | Projection commit's descriptor compare severed | write-direction row (generation-fence suite) |
| T4 | Birth-switch fail-closed → silent live fallback | unresolvable-version row (birth-switch suite) |
| T5 | B3-EXT helper registration severed | 5 failures (scan detection + allowlist rows) |
| T6 | (in-session, batch 2) A7-LOCK compile classifier ignores out-of-domain | corpus differential (disagreement list non-empty) |
| T7–T13 | (batch 8) the pass-2 agent's seven surviving mutations, re-run against the strengthened tree: dark-path read, splice-deleted-import-kept, silent seed drop, M6 reads hoisted, pin un-threaded, lease absent-doc check severed, boundary-probe leg dark | every one killed (see the Pass-2 table); all originals md5-verified restored |

## Verification (final HEAD)

Full vitest suite: **7,355 passed / 53 skipped** (438 files; +7 rows from the pass-2 strengthenings) · rules emulator **128/128** · `vite build` clean · registry catalog lock green (v1+v2 self-consistent, v3 candidate recomputed) · p4 goldens + honesty sweep byte-green · B3 allowlist at its regenerated pin (every new write site human-listed in-branch, incl. the review fixes' own sites — the deny-by-default ratchet caught each one; the pass-2 lease fix adds a READ, no new write site).

## Disclosures carried to the STOP report

1. **Seven substitutions across five hosts await founder ratification at merge** (item-6 scope finding: t-09 + tv-07 beyond the written five; the 3.5 "premise disproven" precedent applied).
2. **F2 (first-activation rollback) is an open founder ruling** — runbook-blocking, not merge-blocking (the runbook does not run at merge).
3. **F7 (Vercel snapshot bundling) verifies only at runbook step 0** against a real deployment.
4. **X6:** endpoint-level candidate compiles carry `metadata_missing` until the base-metadata arc — recorded honestly in the F7-row assertions and the runbook's §II rider; no gate-green claimed.
5. The §2 threshold review tool ran without its own fan-out (its disclosure); the adversarial pass was executed in-session as described above.
6. **L1-1 (the client birth read):** by the written A48 design the client consults the record on every birth with no flag; between merge and the rules deploy that is one DENIED read per agent creation (now time-boxed at 1.5 s; every failure resolves LIVE, writes byte-identical). If the founder wants that window read-free, a client-side gate is a NEW design decision — flagged, not decided.
