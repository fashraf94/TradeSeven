# Composition ACTIVATION step 1.1 — cumulative review record

**Branch:** `ops/composition-flip-1-1` · **Base:** `main` @ `f59e76f3` · **Diff:** 25 files, +561 / −35
**Review trigger:** BUILD_RULES §2 — ≥10 files on the cumulative branch diff. Founder accepted the threshold explicitly when authorizing the fixture reconciliation.
**Session:** 2026-08-16. `git fetch origin` run first (§3). Read-only until the founder authorized 1.1.

---

## Executive verdict

| Item | Result |
|---|---|
| Production dark state before the flip | **OBSERVED CLEAN** — activation + writeEpoch absent, both collections empty |
| Flip diff | **As authorized** — 2 flags, 1 pin, 1 DARK_BY_DESIGN removal, docstrings reconciled |
| Hazard fix (candidate-mode defaults) | **APPLIED at 3 sites**, guarded by 4 defect-sensitive rows, **mutation-checked** |
| Fixture reconciliation | **21 suites**, modelling shipped reality — no flag re-mocking |
| Full suite | **12 failed files / 21 failed tests = byte-equal to baseline; ZERO new failures** |
| `vite build` | **GREEN** (22.10s) |
| A24 structural row | **BENIGN — win32 path-separator artifact in the guard, NOT a B10 violation** |
| Fenced files edited | **NONE** (BUILD_RULES §1) |

---

## 1. Pre-flip verification

**Deployed == tip.** Production is `dpl_BYu3mpsmvuRWEVLjivFxjSQyZZer`, built from `f59e76f3` — read from the deployment's own build log (`Cloning … Commit: f59e76f` at `2026-08-16T03:15:51.799Z`), the same evidence method the 0.1 row used. `main` tip `f59e76f3`. Equal.

**Dark state OBSERVED, not carried** (read-only Firestore probe, project `tradeseven`, `2026-08-16T20:01:29.441Z`):

| Target | Result |
|---|---|
| `composition/activation` | `exists: false` |
| `composition/writeEpoch` | `exists: false` |
| `listDocuments()` over `composition` | `[]` |
| `listDocuments()` over `compositionCandidateState` | `[]` |

`listDocuments()` enumerates phantom parents of subcollections too, so `[]` is the strong form. This matters for the flip's safety claim: with no epoch doc the fence **fails open** (`compositionWriteEpoch.js:117-121`), and with no record `resolveCandidateModeInTx` returns `false` (`compileOnSettingsChange.js:101`). Both flags therefore change **no production behaviour** on the day they light.

**Movement since the 0.1 row:** two commits (`d1b3715a` + its merge `f59e76f3`), one file, `ACTIVATION_RUNBOOK.md` only — a logged freeze exception of the activation's own class.

---

## 2. Dimensions reviewed

Six independent lenses rather than one linear read.

### D1 — Flag correctness and pin reconciliation
`COMPOSITION_EPOCH_FENCE_ENABLED` (`compositionConfig.js:36`) and `COMPOSITION_COMPILED_IDENTITY_ENABLED` (`:76`) are the only flags moved; grep over every `expect(...)` in `src/` + `api/` confirms `composition.acceptance.test.js:185` was the sole literal pin of either. The `DARK_BY_DESIGN` entry for the fence is removed per the guard's own instruction (`flagPinGuard.test.js:249-261` fails otherwise), and a `Pinned by:` pointer was added for the compiled-identity flag because the new guard block pins it (`:263-278` enforces the pointer).

The ⚠ LOAD-BEARING note (`:37-44`) is deliberately retained: post-activation this flag never lowers (A48 / §2 review F5), and it is now binding rather than anticipatory.

### D2 — The dark-merge / flag-off guarantee, inverted
The usual question ("is it inert when off?") is not the one that matters here; the flip makes it live. The right question is **what the lit-but-pre-genesis world does**, and the honest answer is: *the same documents, by a different write path*.

- Battle creation moves from `db.collection('agentBattles').add(doc)` to `commitBattleDocWithPin`'s transactional arm — a descriptor re-read plus `tx.create` (`compositionGenerationFence.js:149-165`). `pin.dark` is false once the flag is lit, so this arm is taken even with no record. The **document is unchanged**; the I/O is not.
- `commitActiveRulesProjection` likewise takes its transaction rather than the bare `agentRef.update` (`:86-107`).
- Provisioners now take a real B2 lease inside `db.runTransaction` (`compositionProvisionerLease.js:94`).

This is stated plainly because the runbook's "behaviour stays byte-identical" is true of **stored state**, not of read/write volume. Extra reads land on every equip, deploy and battle creation from the moment 1.1 deploys.

**Blast radius is narrower than the flip suggests — `COMPILER_ENABLED` is still dark.** `src/config/featureFlags.js:1105` ships `false` and is DARK_BY_DESIGN ("double-gated behind the activationGate"). Every compile entry point returns before doing anything when it is false, so *today*:

- `prepareCompileInputs` returns `null` ⇒ `resolveCandidateModeInTx` never runs ⇒ the compile boundary performs **no reads at all**;
- `writeCompiledBuildsInTx` returns `null` before touching `candidateMode`.

So `COMPOSITION_COMPILED_IDENTITY_ENABLED = true` has **zero production effect** until `COMPILER_ENABLED` flips separately. The only live consequence of step 1.1 is the **epoch fence** — `validateWriteEpochInTx`, `acquireProvisionerLease`, and the `pinActivationDescriptor` → `commitBattleDocWithPin` / `commitActiveRulesProjection` seams. The extra I/O described above is the fence's, not the compile boundary's.

### D3 — The candidate-boundary hazard (the finding that mattered)
`compileOnSettingsChange.js` defaulted `candidateMode` to the raw flag at three sites. Dark, inert; lit, any unthreaded caller silently selects the CANDIDATE registry with **no activation record consulted** — the inference runbook #11 forbids. Verified the shipped call graph is safe *before* concluding: all 12 `prepareCompileInputs` sites pass `db` (e.g. `equip-bundle.js:212`), and all 11 `writeCompiledBuildsInTx` sites thread `compileInputs?.candidateMode`. So the defect was latent, not live — and the defaults are now hard `false`.

### D4 — Test integrity (the "did we buy green?" lens)
The alternative fix — mocking `compositionConfig` dark in the 21 suites — was rejected by the founder and is worth recording as rejected: it would have asserted a configuration we no longer deploy. Every fixture change instead models **pre-genesis production**. The addresses in `compositionStoreDouble.js` are imported from the modules under test, so a doc-id rename breaks the double rather than bypassing it; the double returns `null` for unknown collections so each suite keeps its own `Unmocked collection` guard (that guard is load-bearing and must not become a blanket allow).

### D5 — Mutation checking (BUILD_RULES §2: a row that cannot fail is not a guard)
Reverting all three `candidateMode` defaults to the flag fails **6 rows** — the 3 new anchors plus 3 pre-existing rows that were written against the legacy default. Each new row additionally pairs the defaulted call against an explicit `candidateMode:true` call and asserts they **differ**, so none can pass vacuously. Finding a genuinely differing anchor took three attempts: `tech-volume-surge` and `alloc-sector-cap`/momentum_chaser differ at the *cell* level but not in the written build; `tech-moving-average-trend` on contrarian differs at the **build** level (`core_conflict`, `blocked:true` under legacy) and is the anchor of record.

### D6 — Cross-phase consistency with the runbook
Nothing in this commit writes epoch state, the activation record, or candidate state — those are steps 1.6 onward. `COMPOSITION_MIGRATION_FEED_ENABLED` correctly stays dark until 8B (`ACTIVATION_RUNBOOK.md:157`). The B9 rules-deploy gate and THE ACTIVATION SHA pin are step 1.2/1.4 concerns and are untouched here.

---

## 3. A24 structural row — investigated, NOT fixed (founder-directed)

**Verdict: benign import-graph artifact. NOT a B10 violation.**

`traitLibraryCandidate.composition.test.js:209` walks `api/` and `src/` for importers of the candidate defaults object and compares each against an `ALLOWED` set written with **forward slashes**:

```js
const ALLOWED = new Set(['api/_utils/archetypeRegistry.js', 'src/data/traitLibraryCandidate.js', 'src/services/compositionIdentityClient.js']);
const rel = relative(REPO, full);   // on win32 → 'api\_utils\archetypeRegistry.js'
if (ALLOWED.has(rel)) continue;      // never matches on win32
```

`path.relative` returns `\`-separated paths on win32, so the membership test never matches and the guard reports its own allowlist as violations. The two reported "importers" are **exactly two of the three ALLOWED entries** — the sanctioned batch-6 switch surface — and the failure output shows the backslashes verbatim (`"api\\_utils\\archetypeRegistry.js"`).

- **No new importer exists.** The candidate object remains unreachable from every birth path.
- The row is **green on CI** (Linux) and red only on the founder's win32 machine — which is why `main` ships with it red locally.
- Same defect class as the win32 preflight ENOENT fixed in #768 (`24172545`). Two other baseline reds share the exact mechanism (`agentSafeWireEntry.boundary.test.js`, `archetypeRegistry.test.js`); the rest fail by other means.
- **Cost of leaving it:** on win32 the row is permanently red, so it cannot signal a *real* new importer — the guard is unusable locally precisely where a developer would first see it. Worth its own task before step 5 relies on it; a one-line `.split(path.sep).join('/')` normalisation fixes it.

Not fixed here per BUILD_RULES §3 and the founder's explicit instruction.

---

## 4. Findings — the refutation pass

Each claim below was stated and then attacked, per §2's "a review that never refutes itself has not been run adversarially."

| # | Claim under attack | Attempted refutation | Verdict |
|---|---|---|---|
| C1 | "Zero new test failures vs baseline" | The baseline could have been mismeasured or the comparison could hide flakiness. | **SURVIVES.** The baseline was *measured*, not assumed — `git stash` → full run → `git stash pop`, same machine and session, at `f59e76f3`. The failing-file sets are compared with `comm`; the delta is empty in both directions. |
| C2 | "No assertion was weakened to buy green" | 21 test files changed — an assertion could have been quietly relaxed among the scaffolding. | **SURVIVES, mechanically.** `git diff main...HEAD -- '*.test.js' \| grep '^-' \| grep -E 'expect\(\|toBe\(\|toEqual\('` returns **exactly one line**: the authorized `COMPOSITION_EPOCH_FENCE_ENABLED` pin. Every other change is additive. |
| C3 | "The `candidateMode` default change is a no-op today" | `candidateMode: compileInputs?.candidateMode` passes `undefined` when `compileInputs` is null, which previously fell through to the flag. | **SURVIVES, doubly.** All 11 `writeCompiledBuildsInTx` sites gate on `enabled: COMPILER_ENABLED` (the 12th, `deployBuildValidation.js:200`, passes `inputs.candidateMode` explicitly), and the function returns before reading `candidateMode` when disabled. `compileInputs` is null exactly when `COMPILER_ENABLED` is false. And `COMPILER_ENABLED` is itself `false` — see D3's blast-radius note. |
| C4 | "The battle document is byte-identical under the lit fence" | The fixture now captures from `tx.create`; it could be capturing a *different* document and passing anyway. | **SURVIVES.** `p4Equivalence.battery.test.js`'s "full-doc photograph (file snapshot)" compares against a stored golden and passes unchanged. Had `create` never fired, `captured.doc` would be null and the row would fail loudly, not silently. |
| C5 | "A24 is benign" | It could be a genuine new importer that happens to look like a path bug. | **SURVIVES.** The two reported paths are *exactly two of the three entries in the guard's own ALLOWED set*, and the failure output carries literal backslashes. `path.relative` is confirmed to emit `\` on this platform. No importer outside the sanctioned switch surface exists. |
| C6 | "Freezing the clock in two suites models production" | Freezing a clock is the classic way to make a test lie. | **PARTIALLY REFUTED → narrowed.** The first attempt froze `Date` for the whole `tournamentOrchestrator` suite and broke the deploy-pacing row, which measures real elapsed time — i.e. it *was* distorting. The fix was narrowed to the clone-provisioning block only, and the pacing block keeps a live clock. Recorded because the first attempt was wrong. |

**No CONFIRMED defects in the diff.** C6 records a real mistake caught and corrected mid-review rather than a surviving defect.

---

## 4a. DISCLOSURE — how this review was and was not run

BUILD_RULES §2 requires that a session unable to run the adversarial pass **say so explicitly rather than report the review as done** (the Task 4 Phase 2 precedent). Stating it plainly:

- **The `/code-review` tool pass was launched at high effort and its result could not be retrieved in this session.** It forked to the background and returned no output through any channel available to me (no task handle resolved, no artifact written). I am **not** reporting its findings, because I do not have them.
- **What IS recorded here is this session's own review:** the six independent dimensions in §2 and the six-claim refutation pass in §4, each attack carried out with a concrete mechanical check (a `git diff` filter, a call-site enumeration, a golden-file comparison, a mutation run) rather than by assertion.
- **What that does not give you:** an *independent* reviewer. §2's standard is that findings be handed to someone instructed to refute them; here the author and the refuter are the same session. C6 is the honest evidence that the refutation had teeth — it caught and reversed a distorting fixture change I had already made — but a genuinely independent pass would be stronger.
- **Recommendation:** if you want the independent half before merging, re-run `/code-review high` (or `/code-review ultra`) against this branch from a fresh session and append its findings to §4. Everything else the §2 threshold demands — multi-lens coverage, `vite build`, mutation-checking, a written record — is done and evidenced below.

## 5. Verification performed

| Check | Result |
|---|---|
| `npx vitest run` (full, 484 files) | 12 failed / 469 passed / 3 skipped — **byte-equal to the `f59e76f3` baseline measured in the same session** |
| Baseline measured how | `git stash` → run → `git stash pop`, same machine, same session — not assumed |
| New failures attributable to this commit | **ZERO** (`comm -13` over the two failing-file sets is empty) |
| New passing rows | 4 (8006 total vs 8002 at baseline) |
| `npx vite build` | **green**, 22.10s — the §2 requirement that catches an `App.jsx` syntax error no test would |
| Mutation check on new guard rows | **6 rows fail** under the reverted defaults |
| Fenced-file edits | none — no file on the §1 calibration fence is touched |

**The 12 pre-existing failures** (untouched, reported not fixed per §3): `agentSafeWireEntry.boundary`, `archetypeRegistry`, `fantasyTimesConsensus.n4`, `mandateModelCall.imports`, `mandateMoneyRounding.scan`, `mandateNativeEsm.smoke`, `mandateUniverseSnapshot.imports`, `wireModelCall.imports`, `ws1-observe-walk`, `ruleSupportStatus`, `traitLibraryCandidate.composition`, `dateUtils`.

---

## 6. Reported for separate tasking (BUILD_RULES §3 — not fixed here)

1. **A24 guard is win32-blind** — §3 above. Blocks local use of an activation-relevant invariant before step 5.
2. **Injectable clock vs wall-clock lease TTL.** `ensureCasualClone` / `ensureTrainingClones` mint a B2 lease from the caller's injected `now`, then `assertLeaseCurrent` re-checks against the real clock. That asymmetry is *correct* — the guard exists to catch a provisioner stalled past its TTL, so it must not read a caller-supplied instant — but it means injecting a historical clock is incoherent with the lease. Invisible while the fence was dark. **Not a production defect:** both entry points pass `now: new Date()` (`api/cron/tournament-orchestrator.js:47`, `api/tournament/activate-training-pod.js:74`), so the two clocks agree in production. Worth a decision on whether the injectable-clock contract should be documented or narrowed.
3. **Extra per-request I/O from 1.1** (D2). Not a defect, but the fence's reads are now on every equip/deploy/battle path and were never load-measured. The M7 budget rows measure prompt tokens, not Firestore round trips.
