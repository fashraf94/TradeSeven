# Exit-Behavior Rebalance — Ask 3 Build + §2 Adversarial Review Record

**The profitTarget deterministic executor + the R11 suppression pass — built dark, dual-adversarially reviewed, fix-forwarded.**
Branch `claude/exit-behavior-ask3-profit-target` off `origin/main` @ `63b39160`. Build commits: `881df072` (Phase A), `2438e672` (Phase B), plus the fix-forward/audit commit carrying this record. BUILD_RULES §2 threshold crossed (≈30 files / ≈2,000 lines cumulative) — this is the mandated review record, cited from the PR.

Authoritative set (precedence): Addendum V1.1 → Rulings V1 → Fable Review V1 → Brief V2 → Phase-0 Verification — all five in `docs/` and read from there.

---

## 1. Executive verdict

| Surface | Status |
|---|---|
| profitTarget executor (fenced `agentGuardrails.js`, sanctioned) | **BUILT dark** — winner-side forced exit, `targetFor()` hook, F7 precedence, R6 LOCK deference, R13 replacement path; flag-off byte-identical (behaviorally asserted) |
| `USER_DIRECTIVE_BYPASS_REASONS` (fenced `agentRiskManager.js`, sanctioned) | **BUILT** — additive R2 keystone extension; Knob B step 1b (incl. `requireBenchPositive`), Knob C unconditional skip; LOCKED emergency set untouched |
| R11 suppression pass (`agent-evaluate.js`, non-fenced) | **BUILT dark** — suppression-path-scoped (endorsed shape), full risk-loop execution template, from-scratch F3 provenance, executed by a behavioral suite |
| Keyed lists (4-subsystem mirror, R3) | **BUILT** — `RECEIPT_EXIT_REASONS` + `DETERMINISTIC_LABELS` + `DETERMINISTIC_GATE_TAGS` + calibration `userDirective` lane; D3 exclusion asserted (R4) |
| One-flag gate (F11) | **BUILT** — `PROFIT_TARGET_EXECUTOR_ENABLED` gates compiler shape + STRICTEST + executor + display label + promise copy; pairing test structural |
| Review process | Dual adversarial reviewers (fenced lens + R11 lens) + `/code-review` at high effort; **2 CONFIRMED defects fixed, 5 CR findings fixed, 10 design-concerns dispositioned, all attempted refutations of the executor failed** |
| Tests | Full repo suite green (see §7); `vite build` ✓; calibration smoke (p4Equivalence battery, invariant1Matrix, keystoneGate8, bypassContract) ✓ |

**Dark contract:** with the flag false (merge state), engine behavior is byte-identical — attacked line-by-line by Reviewer A and upheld everywhere after the A1 fix. **Nothing in this PR changes live behavior.** The flag flips WITH Ask 1 per R10, never alone, never in a build PR.

---

## 2. Build map (primary anchors)

- `src/config/featureFlags.js` — `PROFIT_TARGET_EXECUTOR_ENABLED = false` (+ `DARK_BY_DESIGN` entry, `flagPinGuard.test.js`).
- `api/_utils/agentGuardrails.js` *(fenced — edit sanctioned in the kickoff prompt)* — block 2c winner-side target scan (`pickBestTargetBreach`, most-breaching-by-excess, `pending_next_tick` secondaries), `forcedBreach/forcedType` extension, third `thresholdLabel` case, flag-gated soft-note half, `targetFor()` (Tier-3 hook), `guardrailExecutionClass()` + `KNOWN_GUARDRAIL_TYPES` (F11 pairing surface). Existing LOCK/reinforce/replacement compose block reused unchanged — the target inherits R6/R13 by construction.
- `api/_utils/agentRiskManager.js` *(fenced — edit sanctioned)* — `USER_DIRECTIVE_BYPASS_REASONS`, `clearsHurdleFloor` step 1b (`{clears, bypassed, userDirective, reason}` marker), `getRecentSwapCount` unconditional user-directive skip, Invariant-1 docblock amended to the R2 union.
- `api/cron/agent-evaluate.js` — `runSuppressionDeterministicPass` (exported; both gameplan early-return sites call it first), `haikuSwapReason` third clause (pinned two-clause prefix preserved), Knob C user-directive bypass (pinned prefix preserved), flag-gated F3 motive-null stamp.
- `api/_utils/compileBuild.js` — `PROFIT_TARGET_GUARDRAIL_SHAPE` + flag-gated shape-table & STRICTEST entries; purity header amended (module-scope table gate only).
- Keyed lists: `learningEnums.js`, `leagueSwapLedger.js`, `shadowAssemblyCapture.js`, `scripts/calibration/aggregate-real-battles.js` (own `userDirective` lane + report block).
- Display (§9, one flag): `dimensionMapper.js` enforcement label; `StrategyDimensions.jsx` executor-conditional physics hint.
- `docs/BUILD_RULES.md` §7 — `executeSwapServer` site count 5 → 6 (kickoff-sanctioned R11 site).
- Tests: `agentGuardrails.profitTarget.test.js` (executor behavioral, flag-walked), `agentGuardrails.pairing.test.js` (F11 + one-flag structural + STRICTEST pin + dark pin), `agent-evaluate.suppressionPass.test.js` (red-first wiring — watched fail pre-implementation), `agent-evaluate.suppressionPass.behavior.test.js` (executes the pass with mocked I/O), amendments across 10 pinned suites (counts recounted independently by Reviewer B — all honest).

**Fence statement:** the only fenced files edited are the two the kickoff sanctioned. Fenced exports *called* (not edited): `ARCHETYPE_CONFIGS` (pre-existing import), `getArchetypeConfig` (tests). No other fenced file touched; `agentArchetypeConfig.js` unchanged per R5. §2.3 import-boundary ratchet: no new direct importer of a legacy archetype table was added (grep-verified) — no baseline entry required. Gate-7 locked call forms untouched (NO-EDIT honored; count pins amended additively per the W2 precedent, with a new non-colliding Path-E spelling).

---

## 3. STOP-1 dual adversarial review — findings & dispositions

**Reviewer A** (fenced surface; ran the calibration battery + wholesale `api/_utils` = 4,085 tests green; verdict: BLOCK until A1/A2/A3 resolved). **Reviewer B** (R11 pass; verified all 21 call-site identifiers, executed module import, recounted every pin; verdict: no critical defect). Both instructed to refute; the refuted/held split below.

### CONFIRMED (fixed on-branch)

| # | Finding | Fix |
|---|---|---|
| **A1** | Dark-contract breach: the F3 `swapMotive` deterministic-null stamp was live under flag-false — a guardrail-forced stop today would persist `null` where Tier 1 persisted the stale `swap_type`, mutating the R9 **pre-treatment** motive baseline mid-collection | Stamp flag-gated: byte-identical under the dark flag; the F3 null lands at the Ask 1+3 flip. Contract test pins the gated spelling. **Founder note:** the flip therefore changes stop-swap `swapMotive` stamping too — ratified implicitly by F3 ("motive-null on all deterministic reasons"); flagged here so the flip PR states it |
| **A2** | Keyed lists missing (flip-blocking): `RECEIPT_EXIT_REASONS`, `DETERMINISTIC_LABELS` lacked the literal — post-flip corpus gap (fail-closed receipt drop) + "agent decision" mislabel; also `DETERMINISTIC_GATE_TAGS` | All three added (Phase B), plus the calibration lane; enum test 8→9 members; D3 exclusion asserted (R4) |
| **B3** | Distressed-replacement asymmetry: the pass executed into a distressed name the main site would defer | Distressed deferral added to the pass (defer + visible hold beat); behavioral test |
| **B4/B6** | Staleness comment named the wrong mechanism (the real one: silent per-leg `findPortfolioSlot` skip); `evaluationId` double prefix; noBench beat missing the tournament builder; feed action literal mismatch | All four fixed; comment now names the silent-continue honestly |

### /code-review (high effort) — 5 findings, all fixed

| # | Finding | Fix |
|---|---|---|
| CR1 | Promise copy overstated cadence (trigger-gated evaluations can defer a fire) | Copy now carries trigger-gating explicitly |
| CR2 | Calibration `userDirective` lane computed but not reported | `userDirectiveBypass` block threads into `perArchetype` |
| CR3 | §2 audit record absent | This document |
| CR4 | Advisory-type list froze the flag at import while the classifier read call-time | List replaced by flag-independent `KNOWN_GUARDRAIL_TYPES`; advisory membership derived from the classifier only |
| CR5 | `blocked_by_lock` invisible on suppression ticks (no eval record there) | R6 deferral is now a feed beat (B7 doctrine); `pending_next_tick` stays silent by design (fires next tick) |

### DESIGN-CONCERNS dispositioned (no code change; founder visibility)

1. **Cross-symbol lock starvation (A4):** a lock-deferred *stop* on symbol A swallows the tick for an unlocked over-target symbol B (block 2c is stop-gated; the deferred compose returns). Mirrors existing locked-stop-vs-trailing semantics exactly (single-exit invariant); reviewer classified acceptable mirror semantics. **Ask 1's promise copy should disclose that another symbol's lock-deferred stop can defer the target a tick** — or the founder rules fallthrough.
2. **Third suppression path (A5):** the pending-PROPOSAL early return also precedes the guardrail site — same defect class R11 fixed, on a **dormant** path (the launch guard forces autopilot). Recorded hazard, mirrors the `gameplan_rotation` treatment; not touched (outside the kickoff's R11 scope).
3. **Quiet-tick coverage (A-scope/B9):** a breach on a triggerless tick fires at the next *triggered* evaluation. Declared by the compiled shape (`evaluationTiming: 'post_decision_tick'`) and now by the promise copy (CR1). Typical stops are rescued by the cumulative price-drop trigger; a between-bands target can wait longer.
4. **R10 trade-off, stated plainly:** the Phase-0 item-2 stop-suppression defect **stays live until the joint Ask 1+3 flip** — R11's fix is inside the dark flag ("never piecemeal"). This is R10's explicit sequencing; recorded so nobody reads the merge as the fix going live.
5. **Same-tick trade-id collision class (B2):** the pass inherits the pre-existing `tradeCount+1` id convention (autopilot has the identical collision window with the risk loop today; UI consumers key on `evaluationId`, which is unique). Not a regression; separate-tasking candidate.
6. **Narration framing (B6c):** `detectTradeProvenance` classifies guardrail-forced swaps as 'autopilot' narration (pre-existing for main-site stop fires; the pass inherits parity). Tension with F3's spirit — **separate-tasking candidate**, not this build.
7. **`summary.held++` counting quirk:** suppression blocks still count `held` after a pass swap — identical to risk-swap ticks today (the counter tracks "no Haiku eval").
8. **Endorsement provenance (A-g):** the suppression-path-scoped shape (vs the addendum's "hoists" wording) was founder-endorsed in the Ask 3 kickoff prompt: *"R11 implementation shape (endorsed): suppression-path-scoped — the user-directive deterministic class … runs on the gameplan early-return paths (:1803, :1831) before they return; the normal-tick flow is untouched,"* with the catalyst-mutation rationale. Recorded verbatim here so the endorsement is in-repo.

### REFUTED (attempted attacks that failed — the executor held)

Dark byte-identity of `applyGuardrails`/compiler tables; crypto-outgoing, zero/negative/NaN target values, missing entry price (all fail-closed); reinforce + LOCK re-check backstop; R13 held/self-exclusion; R6 no-deferral-heuristic; F7 ordering (structural: risk tier precedes both pass sites; 2c gated on both stop breaches); "most-breaching by excess" = the correct F7 reading; Knob B/C pinned prefixes byte-preserved; write-path races (no field the pass's swap writes is clobbered in a way risk swaps don't already experience); statusFeed vocabulary legality; every count pin honest on independent recount.

### Mutation checks (§2)

Caught by the suites: most-breaching→first-found; lock-check removal; soft-note-under-flag-on. Initially SURVIVING, then closed with new tests: excess-vs-raw-gain ordering (divergent fixture at the F7×F11 intersection); STRICTEST `profitTarget` deletion (structural pin — an absent entry silently flips the §5.5 merge to loosest-wins). Remaining known blind spots, stated: the wiring pins cannot catch a *semantic* typo inside the pass body (mitigated by the behavioral suite executing the real path), and the red-first claim is process history, not an artifact.

---

## 4. Flip-day reconciliation map (for the Ask 1+3 flip PR author)

The flip is **copy + one constant + zero test reconciliation** by construction — everything below was pre-branched in this PR:

- `compileBuild.test.js` profitTarget shape row, `agentGuardrails.test.js` soft-note suite (`describe.runIf`), `dimensionFieldAccess.test.js` enforcement-label pin — all behavior-branched.
- `dimensionMapper.js` label and `StrategyDimensions.jsx` hint flip themselves.
- Still manual in the flip PR: flip the constant, update the pairing test's `toBe(false)` pin, drop the `DARK_BY_DESIGN` entry (the guard's own message walks you through it), and state the A1 consequence (stop-swap `swapMotive` goes null-on-deterministic from the flip forward — the pre/post boundary for the Tier-1 motive baseline read).
- Post-flip first-production-observation items (§6: crons don't run on preview): first suppression-tick fire; first target fire receipt (validator acceptance); calibration report's `userDirectiveBypass` block populating.

## 5. Separate-tasking register (§3 — found, not fixed)

1. Same-tick trade-id collision class across `tradeCount+1` sites (pre-existing; cosmetic-to-low).
2. `detectTradeProvenance` narration framing for guardrail-forced swaps ('autopilot' voice on deterministic fires; pre-existing).
3. Pending-PROPOSAL suppression path lacks the deterministic pass (dormant behind the launch guard; becomes real if copilot mode ever un-guards).

## 6. Founder pre-flip checklist

R10 sequencing holds: this PR merges dark; Ask 1 builds next (its copy must be enforcement-true on day one); one flip PR lights `PROFIT_TARGET_EXECUTOR_ENABLED` + Ask 1's prompt flag together, with R9's rollback trigger armed (N set at flip). Preview smoke on this PR = UI dark-state only (hint copy unchanged, labels 'soft', shapes table 3-wide); the engine surfaces need the first production tick post-flip.

## 7. Verification

- Red-first: the R11 wiring suite was written first and watched fail (29 failures) against the pre-build tree.
- Full repository vitest suite green at the audit commit; `vite build` ✓ (§2 — no test imports `App.jsx`).
- Calibration smoke on the fenced `agentRiskManager` edits: `p4Equivalence.battery` (tiered-mode invariant), `invariant1Matrix` (amended R2-union IFF, both directions, classes distinguished), `keystoneGate8`, `agentGuardrails.bypassContract` — green.
- Reviewer A additionally ran the wholesale `api/_utils` battery (227 files / 4,085 tests) green pre-fix; the post-fix sweep (`api/_utils` + `api/cron` + calibration + touched src) ran 264 files / 4,658 green before the CR fixes, re-run after.
