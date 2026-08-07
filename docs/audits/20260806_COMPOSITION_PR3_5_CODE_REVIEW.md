# Composition PR 3.5 — BUILD_RULES §2 Adversarial Review Record

**Date:** Aug 6, 2026 · **Branch:** `claude/composition-pr3-5-trait-channel` (base `64de6a6b` = PR-3 head `2d6efe0d` + origin/main `01e11501`; **cut from the PR-3 branch because PR 3 is not yet merged to main** — the stacked-PR shape, recorded per §2's cut-from-main rule) · **Scope:** the founder's trait rulings — the three-ladder profile repair + identity v2, the unified host projection (B4-TRAIT), and the three CI invariants. Threshold hit (23 files); two lenses, refute-first, all CONFIRMED findings fixed in-branch.

## Fence sweep (§1)

**PASS — zero fenced files in the diff** (verified against the §1 list by both lenses). Concept-level: decide.js's dark deploy-gate call unchanged; battle-doc shape untouched; p4 prompt goldens byte-green. One recorded graph note (design F5, fixed as a doc correction): the compiler layer now **transitively imports** the resolver via `compositionMigration` — an import EDGE with no runtime read; the resolver header now states the post-3.5 posture, and the two-hop A36 limit was already a recorded design bound.

## The repair verdict (design lens, UPHELD in full)

Independent kernel + ledger recomputation: the three re-authored ladders sit inside their adjudicated domains at every strength, boundaries admitting inclusively, strictly monotone in each trait's semantic direction; registry domains match the ledger rulings (R-111, R-38, R-33); **zero violations remain across all six DEFAULT_TRAITS sets × three strengths**. The RED-by-construction history was reproduced: at the base, invariant (b) fails with exactly the five named rungs (1/2/2 per strength), and the commit order (tests-RED `db1850ef` → repair `421c0b8f`) is the proof the founder ordered. The identity bump was **mandatory** (strengthProfiles are hashed identity content), the v2 snapshot is CI-locked, v1 immutable, and no live pin anywhere carries version-1 or v1-hash literals.

## CONFIRMED findings — all fixed in-branch

| # | Finding (both lenses converged on F1/F2) | Fix |
|---|---|---|
| F1 | **The freshness claim was dead code:** `diffSourceRevisionVector` iterates a fixed key list without `projectedRulesHash` — the deploy gate computed the expected hash and never compared it. A trait-doc/draft-bundle edit (no settingsRev bump, invisible to bundle hashes) would deploy the stale compiled identity in candidate mode — the exact compile≠behave gap B4-TRAIT closes. The vector-movement test row masked it (proved existence+movement, never the comparison) | Presence-aware comparison added: absent-in-both = fresh (legacy/dark unchanged); present-on-either compares strictly — a stored dark build reads STALE the moment candidate mode expects the component. Four-row comparator test added (legacy-fresh / missing-stale / stale-stale / match-fresh) |
| F2 | **Trait-changing saves compiled the PRE-save selection:** `update-agent-settings` threads only `deployedStrategy` into `nextState`, though it is the sole allowlisted `equippedTraits` writer — the in-code comment promised otherwise. A trait equip/unequip minted a rev-N+1 build describing rev N; compounded by F1, that stale build then deployed as "fresh" | `equippedTraits` threaded into `nextState` at the endpoint; a `writeCompiledBuildsInTx`-level row proves the NEXT-state selection compiles (mutation-verified: reverting the fallback kills the row) |
| F3 (test lens) | **Invariant (b) was evadable by param omission:** param-keyed cells failed OPEN when a ladder omitted the constrained param — and tv-10's template default (65) is OUTSIDE the analyst domain, so an omission would ship out-of-domain born-with behavior with (b) green. (Today's surface was coincidentally backstopped by the monotone pins) | (b) now judges **what renders**: the seeded value, else the template default — the omission dodge fails at CI with a named `[template-default (param omitted from ladder)]` offender |
| F3 (design lens) | **Ledger self-contradiction:** the B4-TRAIT row said CLOSED while the retained trait-ruling paragraph still ended "B4 stays OPEN… CI invariant NOT implemented" | The paragraph is now explicitly historical ("the state of record at the STOP, before the trait rulings") pointing at the CLOSURE line and the closed row |

## PLAUSIBLE / recorded (no code change)

- **F4 (design):** `identityVersionTarget = ARCHETYPE_IDENTITY_VERSION + 1` now stamps 3; pre-3.5 artifacts (incl. the D1-ratified dry-run's run doc) say 2. Bounded — nothing validates the field against the live constant, and **FINAL-DRYRUN already mandates a fresh founder-ratified dry-run at the PR-4 candidate SHA**, which re-stamps.
- **F4 (test lens):** the compile-layer dedupe row pins artifact-level exactly-once + trait-first precedence; projection-level exactly-once is guarded at its own layer (`projectActiveRules.test.js`). Recorded so the row is never read as a projection guarantee.
- **F5 (test lens):** the e2e row's hand-tweaked `settingsRev` was inert ballast — removed; the row runs the real rev-match gate.
- **F6 (design):** `hostBundleId = hosting.bundles[0]` is deterministic (Firestore doc-ID ordering preserved end-to-end; hash key-sorted) — attacked and REFUTED as a defect; the doc-ID-first host choice for a dual-hosted rule is provenance-only.
- **F7 / flip-time reconciliation (both lenses):** the endpoint/fence suites pin the candidate flag false and their tx fakes lack `tx.get(collection)` — when the flags flip, those fakes must be reconciled **in the flip PR** (the §2 flag-flip-pin rule). Candidate-mode endpoint round-trips are unit-covered only (the `prepareCompileInputs` candidate-read row + the F2 seam row); named as flip-PR work.

## Live blast radius of the ladder repair (design lens, enumerated)

New births seed the new values; **change-archetype reseeds and training-clone provisioning** also read the live library (existing agents switching archetype get repaired values — correct); hand-equip/strength-change and the trait UI display the new numbers. No persisted doc changes (Method-B: base records untouched); existing agents' persisted 90/65 values become clamp entries at the FINAL-DRYRUN re-ratification; prompts for existing agents unaffected (p4 battery green); enforcement mode 'off'.

## Mutation record

| # | Mutation | Killed by |
|---|---|---|
| T1 | Trait channel severed in `projectHostedRuleDocs` | 6 rows across the candidate + activation suites (incl. invariant (c) end-to-end) |
| T2 | mb-01 moderate un-repaired (45→90) | invariant (b) + (b-monotone) |
| T3 | `hostTraitId` carriage dropped | 3 provenance rows |
| T4 | `projectedRulesHash` severed from the vector | the hash-movement row |
| T5 | Projection drops the draft-bundle channel | the unified-universe row + a PR-2 battery row (the kernel is genuinely shared) |
| T6 | F2 fallback reverted (`agent` doc wins over `nextState`) | the F2 seam row |

## Verification (final HEAD)

Full vitest suite green (final count in the STOP report) · rules emulator 128/128 · `vite build` clean · registry identity lock green at v2 (v1 retained) · PR-2/PR-3 batteries + p4/dark goldens byte-unchanged · invariant (b) RED at `db1850ef` → GREEN from `421c0b8f` (the founder-ordered proof).

## Ratification + disclosures (carried to the STOP report)

1. **The re-authored ladder values await founder ratification at merge** (the ruling: "I ratify before they land" — landing = the merge; the STOP report carries the table).
2. **The repair set is THREE ladders, not two** — the "analyst-only" premise was disproven (tv-01/momentum_chaser at dominant); all three under the same never-widen/never-clamp ruling.
3. **ARCHETYPE_IDENTITY_VERSION 1→2** — mandatory under the registry lock; `identityVersionTarget` becomes 3 (F4 above).
4. **Branch base** — stacked on the un-merged PR-3 branch; merging PR 3 first collapses this PR to its own delta.
5. Flip-PR obligations: fake reconciliation (F7) + candidate-mode endpoint round-trip rows.
