# Composition PR 2 — BUILD_RULES §2 Adversarial Review Record

**Date:** Aug 6, 2026 · **Branch:** `claude/composition-pr2-enforcement` (base `e7de3eed`, post-merge of `origin/main` @ `bbee3fbd`) · **Scope:** the PR 2 cumulative diff — three-layer resolver, write-epoch fence (12 server writer classes + rules layer), offer/equip + whole-config enforcement, D2 display, Method-B migration planner + scan script, identityMigration feed projection, forbidden-read CI rules, flag-ownership table, acceptance rows A4–A12, A23, A27, A36, A41–A42, A44, A46–A49.

**Method (§2 at threshold — the diff exceeds 10 files / 1500 lines):** two independent adversarial lenses (test-integrity; design/correctness), every finding refute-checked before acceptance, mutation-checked where tests were added, `vite build` run explicitly, record written here. Verdicts: **CONFIRMED** (survived refutation → fixed or dispositioned), **REFUTED** (with reasoning), **PLAUSIBLE** (real but bounded; disclosed, not fixed in this PR).

---

## Lens 1 — Test integrity ("would this battery actually fail under its named defects?")

| # | Finding | Verdict | Disposition |
|---|---|---|---|
| C1 | The A9 dedupe row was **vacuous** — the fixture never contained a duplicate snapshot, so the dedupe path was unexecuted | CONFIRMED | Fixed: duplicate-snap fixture added; row now fails when dedupe is removed |
| C2 | The server epoch-doc **address was pinned nowhere** — `WRITE_EPOCH_COLLECTION`/`WRITE_EPOCH_DOC_ID` asserted by no test; the endpoint fake ignored the doc id, so doc-id drift false-passes the battery into a permanently fail-open fence | CONFIRMED | Fixed: address pin test (`composition/writeEpoch`) + the fake now **throws** on any other id |
| C3 | The **change-archetype enforcement gate had zero behavioral coverage** in either direction (only equip-bundle and update-agent-settings handlers were imported) | CONFIRMED | Fixed: two rows — contrarian+r-09 bundle → degen **blocked**; degen+r-09 → contrarian **allowed** (the gate reads the TARGET archetype) — plus the generic-subcollection fake for the seed path |
| C4 | The shipped `COMPOSITION_ENFORCEMENT_MODE='off'` **default was unpinned** — a silent flip to 'enforce' merges green (every suite mocks or injects the flag) | CONFIRMED | Fixed: defaults pin test over `compositionConfig.js` (all three server flags) + the client display flag |
| C5 | Fence-on behavior was **behaviorally proven for 1 of 12 server writers**; the rest had string-only wiring proof satisfiable by dead code | CONFIRMED (partially closed) | Fixed to order-checked static proof: `runTransaction(` idx < `validateWriteEpochInTx(tx, db` idx < first `tx.update(`/`tx.set(`/`txUpdateAgentSettings(`, + the `epoch_closed:[409` sentinel regex, per endpoint. **Residue disclosed:** behavioral fence-on proof exists for equip-bundle (+ casualClone, added post-merge below); the other writers carry the order-checked static proof, not a behavioral row each |
| C6 | The client-fence's only behavioral proof (`npm run test:rules`, 128 tests incl. the 7 composition denials) **does not gate merges** — deliberately off-CI repo-wide per `.github/workflows/tests.yml` | CONFIRMED (pre-existing posture) | Dispositioned, not fixed: rules-suite-off-CI is a repo-wide pre-existing decision, out of PR-2 scope to reverse. In CI the rules layer is guarded only by the census count check (≥5 `epochWriteOpen()` occurrences + address string). **Disclosed to founder** |
| P1 | Fake-Firestore fidelity: writes apply eagerly, no abort-rollback — but the direction of error makes the suite **stricter** than real Firestore for A6/A41 (a buffered-then-aborted write would still count) | PLAUSIBLE | Recorded; no action — errs toward false failure, never false pass |
| P2 | Census scan scope: token scans covered `api/agent` + `api/_utils` only — `api/cron`, `scripts/`, 19 other subdirs invisible | CONFIRMED | Fixed: recursive `walkJs` over all of `api/` + `scripts/` |
| P3 | Forbidden-reads test is single-hop and suffix-based — a transitive import or re-export shim slips it | PLAUSIBLE | Recorded; proportionate tightening (one-hop resolution or the baseline pattern) deferred — the surface is 3 files whose imports are themselves ratcheted |
| P4 | A12's `beforeValue !== undefined` is vacuously true on an empty plan | REFUTED as a live gap | The degen fixture provably yields entries, and an empty-plan defect fails A8/A9 first — the battery covers the edge from another row |
| P5 | 'observe' exists on one of three gates; the asymmetry (update-agent-settings and change-archetype are enforce-only) was untested-as-intended | CONFIRMED (as a documentation gap) | Dispositioned: observe is **equip-bundle-only instrumentation** in PR 2, by design; recorded in the flag table + disclosed |
| P6 | The D2 badge splice's **lit** side is untested (only dark byte-identity is proven); a broken reason-string interpolation surfaces at flip time | PLAUSIBLE | Recorded; dark posture (this PR's obligation) is genuinely guarded — lit-side rows belong to the display-activation PR |

## Lens 2 — Design / correctness (including the refute-directed verdict on the census's hard case)

| # | Finding | Verdict | Disposition |
|---|---|---|---|
| C1 | **Trait/draft-channel blindness**: planner + scanner selected from `equippedBundleIds` snapshots only, but `projectActiveRules` ALSO projects trait-hosted rule docs (`traitId ∈ equippedTraits`, no bundle) and rule docs in ANY non-archived bundle (draft/forged/equipped) — so ~20 shipped trait-hosted banned pairings and every draft-bundle pairing would survive migration while still behaving | CONFIRMED (load-bearing) | Fixed: planner + residual scanner rewritten to select **through `projectActiveRules`** with hosting annotation. The rewrite exposed a real second gap: an equipped→forged status flip alone leaves members projecting — the complete unequip is now status flip + **membership cut** + agent echo. Affects the migration population (disclosed under "dry-run count") |
| C2 | **Projection-channel client-authoring bypasses**: a client-SDK rule/bundle author writes identity content the equip endpoints never see | CONFIRMED (boundary, not defect) | Dispositioned to **PR 3**: the CompiledBuild legality boundary is B9's four-boundary depth for authoring-time content; PR 2's scanner now sees those channels (C1 fix), and the rules-layer fence bounds the write window. Disclosed |
| C3 | `softDeleteReplacedTraitRuleDocs` — a **post-commit writer of the fenced rules store** (change-archetype + trainingClone call sites) — was unfenced. Refute attempt on the transitive-fence claim confirmed it cannot alter derived `activeRules` (it only flips `isDeleted` on docs already excluded from projection), **but** it mutates a store the residual scan reads: a post-watermark soft-delete can dangle planned overlay entries | CONFIRMED | Fixed: epoch guard at `softDeleteReplacedTraitRuleDocs` entry (via `agentRef.firestore`); closed epoch → skip, orphans inert |
| C4 | **Phantom-zero clamp**: `''`/non-numeric param values coerced to 0 and "clamped" to a bound — minting a value the user never set | CONFIRMED | Fixed: `''`/non-numeric are NEVER clamped → `nonNumericClamp` report row for founder adjudication |
| C5 | **Feed duplicates**: one rule banned in N hosting bundles emitted N identical user-facing feed entries | CONFIRMED | Fixed: dedupe by `agentPath\|action\|ruleId\|param` |
| C6 | **Census premise wrong**: the decide.js DERIVED classification cited `equippedBundleIds + hardness` as the projection inputs; the real inputs are rules docs + non-archived bundles + `agent.equippedTraits`, with `resolveForDeploy` (pure, removal-only) applied after | CONFIRMED (argument survives, premise corrected) | Fixed: census + design note restated with the true input set; the corrected argument is *stronger* (removal-only means a window write can never add content) |
| — | **The transitive-fence classification of `decide.js`'s activeRules write** (the census hard case) | **UPHELD** under directed refutation | `projectActiveRules` is a pure function of epoch-fenced stores; `resolveForDeploy` is pure and removal-only; the residual scan reads authority stores through the resolver, never `activeRules`. `founderReviewFlag: true` stands in the census; the optional PR-4 fenced splice remains available if the founder rejects the classification |
| P1 | `applyFieldValue` splits on `.` before bracket parsing — a snapshot id containing a dot makes the planner-minted field unresolvable (`applied:false` → dangling) | PLAUSIBLE | Recorded; no current id-minting path produces dots (Firestore auto-ids, `bornwith__`); danglings are surfaced, never silent |
| P2 | The scan script's `'/'→'~'` doc-id encoding is not injective (contrived collision) | PLAUSIBLE | Recorded; stored entries carry the true `entryKey`, damage bounded to overwrite |
| P3/P4 | `domainAdmits` numeric coercion asymmetry (authored-string vs stored-number) | PLAUSIBLE | Recorded; candidate registry authors numbers; the '' guard (C4) covers the dangerous case |
| P5 | `assertWriteEpochOpen` defaults to the (off) flag, so the scan script's guards were dead code until the flag PR — `--apply` unguarded against a closed epoch | CONFIRMED | Fixed: `migration-scan.js` passes `{enabled: true}` — always-on guard in the runner regardless of the flag |
| P6 | Non-atomic apply: run doc written FIRST, then entry batches — an interrupted apply leaves a run doc overstating `entryCount` | CONFIRMED | Fixed: order inverted — entries batches first, **run doc last as the completion sentinel** |
| P7 | Observe mode filtered to blocking violations before attaching — halving the instrumentation value | CONFIRMED | Fixed: observe attaches ALL violations (incl. `ambiguous_domain_binding`) |
| P8 | A46's mechanical census detects writers only via two token scans; raw-`.update()` writers invisible | CONFIRMED (materialized post-merge!) | Partially fixed by P2 (recursive scope); **fully materialized by PR #716's `casualClone.js`** (see merge reconciliation below) — now additionally ratcheted on `copyAgentSubcollections` callers |
| P10 | `overlayContentHash` covers `migrationRunId`, so cross-invocation hash reproducibility requires reusing the runId | PLAUSIBLE | Recorded; within one apply the hash is deterministic; the activation record (PR 4) pins the runId it ratifies |

## Merge reconciliation — PR #716 landed on `main` mid-PR-2 (Aug 6)

`origin/main` moved `e7de3eed → bbee3fbd` while this branch was in flight, adding **`casualClone.ensureCasualClone`** — an endpoint-invoked, non-transactional, raw-write provisioner that births AND re-syncs identity state, **including the rules/bundles subcollections via `copyAgentSubcollections`**. This is exactly the P8 writer class, and it was invisible to every mechanical census check (no `txUpdateAgentSettings`, no `writeCompiledBuildsInTx`, no transaction). Caught by manual merge review, reconciled on this branch:

- `assertWriteEpochOpen(db)` at `ensureCasualClone` entry (zero I/O dark; throws before any read/write when closed) — `casualClone.js`
- `ensure-casual-clone` endpoint maps `epoch_closed` → 409, nothing written
- Census row added (`backgroundLoops`); design note §3 row extended
- **A46 gains a third mechanical ratchet:** every `copyAgentSubcollections` caller — any directory — must be a censused provisioner (mutation M12 proves it fires)
- Behavior proof added: closed epoch rejects the provisioner at entry with `writes=0` (mutation M11 proves it is the load-bearing guard — the census string check alone survives an import-only residue)

Auto-merged files (`trainingClone.js`, `firestore.rules`, `featureFlags.js`) hand-verified coherent: the agents-create clause composes `epochWriteOpen()` with #716's clone-namespace reservation; `CASUAL_CLONE_CONCURRENCY_ENABLED=false` and the fence flag are independently dark. The casual-clone suites pass **unmodified** — the dark guard is byte-identical.

## Mutation record (scratch worktree, one mutation at a time, each reverted)

| # | Mutation (injected defect) | Killed by | Result |
|---|---|---|---|
| M1 | Resolver: epoch layer applied BEFORE overlay | A47 | ✅ 1 failed |
| M2 | Resolver: abandoned epochs resolve anyway | A49 | ✅ 1 failed |
| M3 | Planner: clamp always to MIN | M4 nearest-bound row | ✅ 1 failed |
| M4 | Kernel: `deferred` treated as legal | A5 + battery | ✅ 2 failed |
| M5 | Epoch helper: dark path still reads | A23 zero-read | ✅ 1 failed |
| M6 | Census: endpoint dropped from census | A46 | ✅ 2 failed |
| M7 | Endpoint: enforce throw skipped | A4 | ✅ 3 failed |
| M8 | Feed: projector ignores the activation record | A44 | ✅ 1 failed |
| M9 † | Planner: core_conflict **membership cut deleted** | A8 complete-unequip + A10 scan-clean + draft-channel row | ✅ 3 failed |
| M10 † | Planner: **trait-channel cut deleted** | trait-channel row (equippedTraits unequip + scan-clean) | ✅ 1 failed |
| M11 † | casualClone: **epoch entry guard deleted** | provisioner behavior row (endpoints suite) | ✅ 1 failed — and the census string check alone did NOT fire (import line satisfies it): the behavior row is load-bearing, recorded under lens-1 C5 residue |
| M12 † | Uncensused `copyAgentSubcollections` caller scaffolded | the new A46 provisioner ratchet | ✅ 1 failed |
| M13 ‡ | `scanResidualsAfterPlan`: the dry-run reporter's raw-`ruleDocs` bug re-introduced into the shared helper | A10 helper row + the named reporter-regression row | ✅ 2 failed |

† = post-rewrite spot-checks added after the C1 planner rewrite and the #716 reconciliation, since M1–M8 predate both.
‡ = added with the founder fold-in (Aug 6 addendum) guarding the dry-run reporter fix.

## Verification evidence (merged tree, final)

- Composition battery: **61 tests green** across 5 suites (acceptance 32 · endpoints 13 · census 6 · forbidden-reads 5 · display 5)
- Full vitest suite: **7050 passed** (409 files; 53 skipped, pre-existing)
- Rules emulator: **128/128** (incl. 7 `compositionEpochDenials` + #716's new masteryDenials rows)
- `vite build`: ✅ clean (chunk-size warning pre-existing)
- Import-boundary ratchet (§2.3): green — the PR routes its trait lookup through `archetypeRegistry.getTraitById` (new export on the sanctioned surface) instead of a new direct `traitLibrary.js` importer

## Addendum — founder rulings + dry-run ratification (Aug 6, 2026, post-review)

- **Dry-run of record: 52 scanned · 6 affected (all house/training agents) · 15 entries. D1 RATIFIED** — population benign, migration proceeds as planned.
- **Reporter defect found by the dry-run (fixed):** the runner's inline pre-verification fed **raw pre-overlay `ruleDocs`** to `scanAgentForResiduals` while agent + bundles were resolved — all 9 reported residuals were phantoms mapping 1:1 to planner ruleDoc entries. The resolve-then-scan composition is now the shared `scanResidualsAfterPlan` helper (`compositionMigration.js`), called by both the runner and the A10 battery; regression rows added (ruleDoc-clamped agent scans clean through the helper AND the raw-docs phantom shape provably reports; an unplanned violation still fails). This closes the lens-2 concern class "script re-implements a tested composition inline."
- **decide.js DERIVED classification ACCEPTED** — census `founderReviewFlag` resolved with the ruling recorded (disclosure 8 closed); the PR-4 splice remains available but is not required.
- **`REPLACEMENT_MAPS` stays empty (ruling a):** the 4 enum narrowings unequip per M4's reject-and-unequip arm.
- **The 6 `needsBinding` rows are PR 3 input (ruling b):** the §2-item-3 `valueParamKey` binding table at the CompiledBuild boundary — rule×param list recorded in the design note §4a (`alloc-sector-cap`, `alloc-sector-minimum`, `gs-02`, `mb-11`, `th-05`, `tv-12` with their param keys and ambiguous cells).
- Operational fold-ins: `scripts/loadLocalEnv.js` wired into `migration-scan.js` (missing creds now self-explain); `scripts/composition/out/` gitignored.

## Standing disclosures (carried to the STOP report)

1. **Live dry-run count** — ~~founder-run pending~~ **resolved: see addendum above** (52/6/15, ratified).
2. **Rules suite off-CI** (lens-1 C6) — pre-existing repo-wide; the client fence's behavioral proof is local-only; `firestore.rules` changes are **inert until the founder's Console deploy** (`npm run deploy:rules`).
3. **A48** (activation-record property) is **PR 4** — not in this battery.
4. **A11** is **PR 3** (recorded at PR 1).
5. **C2 projection-channel authoring bypasses** close at the PR-3 CompiledBuild legality boundary.
6. **Observe mode is equip-bundle-only instrumentation** in PR 2 (lens-1 P5).
7. **Feed `ACTION_COPY` is product copy** — needs founder review before the feed flag ever lights.
8. **decide.js DERIVED classification** — ~~carries `founderReviewFlag: true`~~ **resolved: ACCEPTED by founder ruling (see addendum)**.
