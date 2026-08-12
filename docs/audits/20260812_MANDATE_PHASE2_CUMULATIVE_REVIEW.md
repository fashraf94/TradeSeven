# Mandate Substrate — Phase 2 cumulative adversarial review

**Date:** 2026-08-12
**Branch:** `claude/mandate-substrate-phase-2` (cut from `origin/main` post-#742/#743)
**Scope:** Phase 2 of 6 — the evaluation pipeline (§3.0–§3.5). 30 files, ~3,984 insertions.
**Spec:** `docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md` · **Charter:** `docs/QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_2.md`
**Method:** Phase-1 two-pass pattern — four independent adversarial reviewers (money math, C-21/gate, architecture invariants, spec-faithfulness/do-not-build-ahead), then a verification pass that confirmed each finding against the code and applied fixes. Diff exceeds the §2 threshold (>10 files / 1500 lines), so a high-effort review was mandatory.

---

## 1. What was built (the 10 kickoff items + scaffolding)

| # | Item | Module(s) |
|---|---|---|
| 1 | Two-layer snapshot builder (§3.0) | `mandateUniverseSnapshot.js`, `mandateCandidateUniverse.js` |
| 2 | Sole-fetch dependency test | `mandateUniverseSnapshot.imports.test.js` (+ `__fixtures__/mandateEvalPathClosure.js`) |
| 3 | Market-calendar gating, session-relative slots (§3.1) | `mandateSessionSlots.js` |
| 4 | Eval handler, bounded sweep, owner-token lease (§3.1) | `api/cron/mandate-evaluate.js`, `mandateLease.js` |
| 5 | Model seam, submission envelope, deterministic requestId (§3.3) | `mandateModelCall.js` (+ sole-Anthropic-importer test) |
| 6 | Prompt assembly from the pinned vintage (§3.2) | `mandatePromptAssembly.js`, `mandateContextBlock.js` (+ registry + input-allowlist tripwire) |
| 7 | Decision tool + deterministic gate (§3.4) | `mandateDecisionTool.js`, `mandateSectorCap.js`, `mandateGate.js` |
| 8 | Atomic execution boundary (§3.5) | `mandateExecution.js`, `mandateValuation.js` |
| 9 | Execution engine, forked season math (§4.1) | `mandateExecution.js` |
| 10 | Price-drift guard (§3.3) | `mandateExecution.validateEnvelope` |

Config additions (`mandateConfig.js`), the sweep composite index (`firestore.indexes.json`), and the §8 fork-ledger note round it out. Everything ships **dark** behind `MANAGED_MANDATE_ENABLED && MANDATE_EVAL_ENABLED` (both `false`); no `vercel.json` registration (P6).

**Tests:** 173 mandate unit tests pass; the battle honesty suite, flag-pin guard, archetype ratchet, `wireModelCall` sole-importer, and `buildArenaModel` all stay green (no cross-coupling).

---

## 2. Pass 1 — findings (four reviewers)

### Money / execution
- **M1 [HIGH]** Realized P&L and share quantity computed but never persisted (`buildDecision` had no field). Unrecoverable from the record afterward.
- **M2 [MED]** The §3.5 "Σ marks + cash === totalValue" invariant was tautological (both sides from one `markBook` call) → false assurance, could never fire.
- **M3 [LOW-MED]** No guard for a zero/negative harvest mark → `Infinity` shares / phantom position on a 0-priced "complete" symbol; negative mark drains cash on a SELL.
- **M4 [LOW]** TRIM rounding could leave a 1e-6-share, $0-basis dust position.
- **M5 [LOW]** `bankersRound` half-detection tolerance (fixed 1e-9) too tight at $millions → not true half-to-even for large sums.
- **M6 [LOW]** TRIM mislabeled a natural full-trim as `clamped`.
- Verdict on the 8 hunt classes: avg-cost basis, cash-can't-go-negative, quantity clamp, atomicity/exactly-once, HWM/drawdown non-writes — **all confirmed correct.**

### C-21 / gate
- **C1 [HIGH, fail-open]** Sector-cap numerator used stale `pos.lastMark` while the denominator used fresh marks → understated concentration, **failed open** (the O-5/Q1 hazard). Positions with no `lastMark` were invisible to the cap.
- **C2 [HIGH, constitutional]** A permanently-frozen held symbol (delisted/halted, no fresh mark) could **never be exited** — the gate deferred and the executor refused, with no fallback to the last-good mark. Violates C-21 clause 3 ("no exit-suppressing state may be indefinite") and §4.3 ("exit … at last good mark"). *The transient-stale defer was fine; the unbounded case was the defect.*
- **C3 [MED-HIGH, I2]** `priceAsOf` was the fetch instant, not the market timestamp → age-freshness was whole-book, not per-symbol; a stale echoed price read as fresh. (Same root as arch **F2**.)
- **C4 [MED, fail-closed defeat]** The gate substituted a `seedSectorFor` guess when the daily sector was null, bypassing the fail-closed unknown-sector refusal and mixing taxonomies.
- **C5 / C6 [LOW]** `classifyHeldFreshness` had no `maxAgeMs` default (omission → whole-book freeze); `markBook` keyed by the raw position key (a non-canonical key → spurious `not_held` on a fresh exit).
- **C-21 core confirmed:** a SELL on fresh data is never blocked by any entry gate, quarantine, or bootstrap state — the exit lane precedes and bypasses them.

### Architecture invariants
- **F1 [HIGH]** Both sole-importer scans were **filename-globbed** (`mandate*`), not import-graph — a non-`mandate*` helper on the path, or a route through a shared seam (`wireModelCall`), would evade them. This is Risk #2, the largest scaling risk.
- **F2 [MAJOR]** `fetchBatchQuotes` returns `current: close ?? previousClose`; the builder marked that complete with `priceAsOf = now`, so **yesterday's close masqueraded as a fresh mark**. (Same root as C3.)
- **F3 [MINOR, latent]** The I11 candidate floor / `degraded` flag were computed *before* the size-budget trim and never recomputed → the byte budget could crowd candidates below the floor with `degraded:false`.
- **F4 [MINOR, dated]** No guard past `MAINTAINED_HOLIDAY_YEARS` (2028+ holidays would read as full sessions).
- **F5 [MINOR]** Snapshot idempotency is get-then-set, not atomic → a rare concurrent double-fetch (accepted, documented).
- **F6 [NIT]** Session wall-clock constants restated, not imported (matches the `mandateCalendar` precedent).
- **Checked clean:** held never dropped for cap/size, `bumpUpstreamCounter` exactly-once/atomic, slot windows non-overlapping incl. early-close, owner-token lease correctness, both scans non-vacuous within their namespace.

### Spec faithfulness / do-not-build-ahead
- **S1 [HIGH]** The bounded sweep paginated over `health.lastSuccessfulEvalAt` — **a field it mutates** — with a durable value-cursor holding a stale coordinate. The wrap (F24 completion proof) rarely fired, and at a slot boundary the stale cursor could `startAfter` past not-yet-served books → a book could **miss a slot**.
- **S2 [MED]** A §3.5 invariant abort (`status:'failed'`) was booked as success → **reset** the failure streak instead of incrementing it (contradicts §3.5; masks the P3-quarantine condition).
- **S3 [LOW-MED]** Double full-scan of active books per fire; the ordered sweep silently drops any book missing `health.lastSuccessfulEvalAt`.
- **S4 [LOW]** `MANDATE_STALE_STREAK_ALERT` is a P3 constant with no P2 consumer (violates the config file's do-not-build-ahead rule).
- **S5 [LOW]** Token-budget handling threw (blocked) in the degenerate case; §6.3 is "alert, not block."
- **S6 [LOW]** Thrown model-call errors weren't stamped `lastEvalTickKey` → a persistently-erroring book re-billed every generous fire in the slot.
- **Do-not-build-ahead: essentially clean.** No close pass / friction values / risk metrics / corporate actions (P3); no rollover / escape (P4); no batch transport / drain / last-tick-no-submit / caching (P5); no `vercel.json` (P6). `isLastSlotForTier` exists but is inert (P5 wiring). Envelope + requestId + harvest validation are P2-correct (they back §3.5 exactly-once), not build-ahead.
- Config constants all match the spec's initials; the `$10M` vs §9-row `$100K` conflict is correctly flagged in-code (D-43 governs).

**Self-review (before the reviewers) already caught and fixed:** within-slot double-eval — the cron "fires generously," so a re-fire would re-evaluate a book at its *new* revision (a new `requestId`, so the decision-doc claim doesn't dedupe it). Fixed with a crash-atomic `execState.lastEvalTickKey` stamp written *inside* the execution transaction + a handler skip-guard.

---

## 3. Pass 2 — dispositions (all verified against the code, fixes applied)

| Finding | Disposition |
|---|---|
| **M1** | `executedShares` + `realizedPnl` added to `buildDecision`; the executed write persists them. |
| **M2** | Replaced with a real conservation check: `newTotalValue ≈ preTotalValue − Σfriction` against an **independent** pre-mutation baseline (dedicated `MANDATE_VALUE_CONSERVE_TOLERANCE_USD` absorbs legit 2dp rounding; a share/cash mis-record moves value ≫ that). |
| **M3** | Entry requires `mark > 0` (→ `rejected_stale`); exit resolves to the first positive of {fresh, carry-over, basis}. |
| **M4** | Sub-share residual after TRIM is sold in full (dust guard). |
| **M5** | Relative half-detection tolerance (`1e-9·max(1,|scaled|)`) → half-to-even at all magnitudes. |
| **M6** | `clamped` set only on **strict** over-ask. |
| **C1** | `checkSectorCap` now takes the **fresh** `sectorExposureUsd` from `markBook`; the stale-`lastMark` recompute is gone. Regression test added (fresh mark 300 vs stale lastMark 100 → cap fires). |
| **C2** | Exit lane **always passes** a held SELL/TRIM; the executor fills at the fresh mark, else the last-good (carry-over) mark, else basis (§4.3). `validateEnvelope`'s mark/drift checks apply to **entries only** — an exit is never suppressed by data quality. *(Automated CA forced-close remains P3; this only unblocks the manager-initiated exit — see §5.)* |
| **C3 / F2** | Mark = the raw `close` (never the `previousClose` fallback); `priceAsOf` = the upstream quote timestamp when present. Test proves a previousClose-only symbol freezes. |
| **C4** | Gate uses the **daily-snapshot sector only** — no seed guess; a null sector fails closed. Test added. |
| **C5 / C6** | `classifyHeldFreshness` defaults `maxAgeMs`; `markBook` normalizes position keys. |
| **F1** | Both scans rewritten over the **transitive import closure** of the handler entry point (`__fixtures__/mandateEvalPathClosure.js`), stopping at the two sole importers. Scoped to `api/` eval-path modules. |
| **F3** | Floor/`degraded` recomputed on the **trimmed** entries; alert notes size-drops. |
| **F4** | `resolveSessionSlots` fails closed beyond `MAINTAINED_HOLIDAY_YEARS`. |
| **F5** | Accepted + documented: the platform snapshot build is get-then-set; the counter stays accurate (it counts real calls), and a concurrent double-build only wastes a handful of upstream calls (well under quota). The handler now also skips the build entirely once a slot's snapshot exists. |
| **F6** | Left as-is (matches the `mandateCalendar` provenance-note precedent). |
| **S1** | **Durable cursor removed.** Each fire re-queries `orderBy(lastSuccessfulEvalAt asc).limit(PAGE_SIZE)`; the mutated key advances the frontier and `lastEvalTickKey` gives within-slot idempotency. Completion = a page with zero newly-evaluated books. |
| **S2** | `status:'failed'` now **increments** `consecutiveEvalFailures`, never resets. |
| **S3** | Held-union full scan runs only on the first fire of a slot (skipped once the snapshot exists). The `lastSuccessfulEvalAt`-present dependency is documented (Phase-1 `buildHealthBlock` guarantees it). |
| **S4** | `MANDATE_STALE_STREAK_ALERT` removed (deferred to P3). |
| **S5** | Trim-to-fit (enforcement) + an alert on any trim; the degenerate case alerts and **proceeds** (not block, §6.3). |
| **S6** | Hard model errors now stamp `lastEvalTickKey` too (no per-slot re-bill). |

---

## 4. Ambiguities and readings chosen (for founder review)

1. **`PROMPT_CONTRIBUTING_MODULES` registration (§3.2).** Read as "register in *a* prompt-contributing-modules registry": built a mandate-scoped registry + input-allowlist tripwire (`__fixtures__/mandatePromptRegistry.js`, `mandatePromptAssembly.honesty.test.js`) rather than polluting the battle-specific C-20 registry (whose forbidden-signal list and fenced-assembler tripwire are battle-only and would cross-couple the suites). The tripwire enforces the substantive §3.2 guard directly — the assembler imports **no** live registry/model-config source. *If literal membership in the shared C-20 list is intended, it is a one-line follow-up.* (Also noted in the spec §8.)
2. **Gate sizing vs. hard gates (§3.4.3).** Cash-floor is applied as a **size-to-fit clamp** (§4.1 "a BUY is sized down to fit available cash"), a hard gate only at zero room; sector cap, weight cap, and position count are hard rejections. Sizing necessarily precedes the concentration checks.
3. **Curated candidate universe.** 136 liquid large/mid-caps across 11 sectors — comfortably above the 100 floor, below the 300 cap. Sector is authoritatively the daily-layer fundamentals value; the static per-sector grouping is a documented seed/fallback (used for tests, not the money gate).
4. **HOLD is a terminal `executed` decision** (records the audit row, clears `openBatchId`, bumps `revision`) per I1 "every submission reaches exactly one terminal state." It increments the `executed` counter — a book that only ever HOLDs is a legitimate healthy state, distinguished from a never-*trading*-due-to-failure book by the (P3) stale-rejection streak, not the executed ratio.

---

## 5. Flagged for P3 (known phase boundaries, not defects)

- **Delisted-symbol exit.** P2 now lets a manager-initiated SELL/TRIM fill at the last-good (carry-over) mark, so no exit is indefinitely suppressed (C-21). The **automated** corporate-action detection + forced `CORPORATE_CLOSE` (delisting/split/dividend, the gap detector, the CA feed) is P3 (§4.3) and is *not* built here.
- **Friction values.** P2 executes at zero friction (`MANDATE_FRICTION_MODEL_VERSION = 'p2_zero_friction'`), receipts already carry the honesty labels; the market-cap-tier spread proxy + slippage land in P3 (§4.1).
- **Liveness alerting.** `execState.submitted/executed` are maintained in P2; the streak/liveness-floor thresholds and quarantine consume them in P3 (§6.4).
- **Regime provenance** in the context block is `unknown` until P3 (§6.1).
- **Batch transport, drain protocol, last-tick-no-submit rule, prompt caching, cadence-tier turnaround** — P5. `isLastSlotForTier` is computed now (inert) so P5 wires it without re-deriving the calendar.
- **Sweep ordering dependency.** The `orderBy(health.lastSuccessfulEvalAt)` sweep relies on that field being present on every active book; Phase-1 `buildHealthBlock` seeds it to `null` (present). Any future create/migration path must preserve that or the book becomes invisible to the sweep.

---

## 6. Verdict

All four reviewers' confirmed findings (2 HIGH-fail-open/constitutional, 1 HIGH-scaling, 1 HIGH-sweep, 1 MAJOR-freshness, plus the medium/low set) are fixed and covered by tests; the do-not-build-ahead line holds. Phase 2 is a **working, dark, tested** evaluation pipeline. Opened as a PR (not merged) for founder review per the kickoff.

---

## 7. Founder close-out (2026-08-12) — rulings, rider, CI fix

**Rulings on §4 (all four ratified as built):** (1) mandate-scoped prompt registry — ratified; literal C-20 membership explicitly declined (cross-coupling); recorded in spec §8. (2) exit-at-last-good-mark — ratified **with a rider** (below). (3) cash-floor size-to-fit clamp — ratified. (4) HOLD as terminal `executed` — ratified; a comment at the `execState.submitted/executed` counters now records that liveness is judged by the P3 **stale-rejection streak**, not the executed ratio, so P3 wires the floor to the right signal.

**Rider (ruling #2):** the decision receipt now records **`fillMarkQuality: 'fresh' | 'carry_over' | 'basis'`** (`buildDecision` field; set from the exec receipt's `markSource`, `'snapshot'→'fresh'`). P3 scoring/narration can now tell a degraded fill from a fresh one. Test: an executed BUY records `'fresh'`; a frozen-symbol SELL that fills at the last-good mark records `'carry_over'`.

**CI fix — the protected-store scan (the only red):** twelve new mandate write sites, deny-by-default doing its job (same class as Phase-1 Task 1). Resolvability checked first:

- **Made RESOLVABLE (preferred over allowlisting):** `ensureUniverseSnapshot` and `ensureDailySnapshot` used `db.collection(CONST)`; inlining the string literal at the callee-base `ref.set()` lets the scanner resolve them to the non-protected `mandateUniverseSnapshots` / `mandateUniverseDaily` stores → **no allowlist entry**.
- **Allowlisted (10, each count 1, with per-entry notes in the allowlist `_notes_spec1_phase2`):** the scanner cannot statically resolve a `tx.set(ref,…)` **handle-form ref argument** (only callee-base chains), and none of these may be restructured away from their atomic transactions.

| Site | Verified write target(s) | Protected? |
|---|---|---|
| `mandateExecution::executeDecision` (set, update) | `mandates/{id}/decisions/{decisionId}` (receipt) + `mandates/{id}` (portfolio/revision/execState) | no |
| `mandateExecution::writeTerminal` (set, update) | same pair, for a non-executing terminal transition | no |
| `mandateLease::acquireLease/releaseLease/renewLease` (set) | the `lease` **field** on `mandates/{id}` (not a separate doc) | no |
| `mandateUniverseSnapshot::bumpUpstreamCounter` (set) | `mandateUpstreamCalls/{date}` (daily counter) | no |
| `mandate-evaluate handler::call:acquireLease#1 / call:releaseLease#1` | one-hop into the lease writes above (ref = query `docSnap.ref`) | no |

**None touches a composition-protected store.** This statement is the human review the guard demands. Scan re-run: **9/9 green.**

---

## 8. Standing instruction for P3–P6 (founder, effective now)

Every remaining phase adds write sites, so this scan **will** fire again by design. Standing rule, part of each phase's definition of done: **review-and-allowlist new protected-store write sites in the same PR as the phase that introduces them** — resolvability check first (prefer a static-literal collection over an allowlist entry where it's a clean change; never restructure a transaction to achieve it), a verified write-target statement in the PR, allowlist entries with per-entry notes. Not a post-CI surprise.
