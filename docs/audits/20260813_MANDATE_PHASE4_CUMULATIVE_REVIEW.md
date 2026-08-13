# Spec 1 — Mandate Substrate — Phase 4 Cumulative Review

**Phase:** P4 of 6 (the lifecycle phase — rollover FR-1, the escape hatch FR-3, quarterSummaries FR-2).
**Branch:** `claude/phase-4-mandate-lifecycle` off `main` @ `8c1bdc4d` (with P1 #740, P2 #745, P3 #750 merged).
**Diff at review:** 22 files, +2604 −26. Over the BUILD_RULES §2 threshold (≥10 files / ≥1500 lines) → the multi-lens adversarial + refute-with-repro review below is mandatory.
**Everything ships dark:** `MANDATE_ROLLOVER_ENABLED` default false; escape gated on the `MANAGED_MANDATE_ENABLED` master; the accelerated-clock endpoint founder-gated (`MANDATE_FOUNDER_CREATE_ENABLED` + allowlist). No `vercel.json` registration (P6); crons don't run on preview.

---

## 0. Step 0 — drift check (CLEAN, no STOP)

`git fetch origin` first. Verified with file:line by a six-reader understanding pass (all VERIFIED this session):

| # | Item | Verdict | Anchor |
|---|------|---------|--------|
| 1 | P3 modules unchanged + consistent (closeBook sole peak writer; eval/close sweep attempt-marker keys `health.lastEvalSweepAt` / `health.lastCloseAttemptAt`; `consecutiveCloseFailures`) | CLEAN | `mandateClosePass.js:152,441-448`; `mandate-evaluate.js:290,568`; `mandateSchema.js:99-105` |
| 2 | Vintage publish + Risk-3 assertion (composition resolves against current `ARCHETYPE_IDENTITY_VERSION` before any write) | CLEAN | `mandateVintage.js:69-76,156-175` |
| 3 | `status+nextRolloverAt ASC` composite index present | CLEAN | `firestore.indexes.json:463-475` |
| 4 | `userMeta/{uid}` shape (`activeMandateId`, `mandateEscapeHatchUsed`, `lastCreateRequestKey`) unchanged; escape confirmed unbuilt | CLEAN | `mandateCreationService.js:95,102,111,118,121-122` |
| 5 | `computeNextRolloverAt` is the SINGLE boundary normalizer (creation + rollover reuse it) — the I4 consistency the phase rests on | CLEAN | `mandateCalendar.js:154-174`; creation call `mandateCreationService.js:67` |

**Latent P3 defect surfaced by the Step-0 read and fixed in this PR (in-scope — the harness pays exactly this debt):** `MANDATE_MISSED_MARKS_ALERT` was used at `mandate-evaluate.js:616` (the close-sweep failure path) but never imported into the file. Under any close-failure fire the durable-trace write committed, then that line threw a `ReferenceError` caught by the inner `catch`, which double-counted `summary.errors` and logged a spurious "persist FAILED" — making the `MANDATE_CLOSE_FAILED_STREAK` §6.4 alert structurally unreachable. The suite stayed green because no P3 test drove `runCloseSweep`'s catch. Fixed by adding the import; the integration harness requirement (a) is its mutation guard (it fails without the fix).

---

## 1. What was built (the 5 kickoff items + scaffolding)

**Item 1 — the handler-level integration harness (P3's declared test debt; blocked the rest).**
- `api/_utils/__testsupport__/mandateFakeFirestore.js` — a **transaction-faithful** in-memory fake (test-support only, invisible to the sole-fetch + protected-store scans). Models the real Admin-SDK contract: a versioned store, read-set-validated optimistic concurrency with retry (`tx.get` records versions; a changed read at commit → ABORTED → the callback re-runs against the winner's state), buffered atomic commit, create-if-absent (ALREADY_EXISTS code 6), deep-merge `set({merge})`, dotted-path `update`, the full query engine (where/orderBy/limit/startAfter cursor), and a deterministic **interleaving barrier** to script "A reads, B commits, A retries." **Substrate choice (per the kickoff):** a fake, not the emulator — the emulator is wired for security-rules only (Java-gated, auto-skips), gives nondeterministic interleaving, and would pull the suite off its fast-fake idiom; the fake models the exact contract the three revision writers depend on and gives deterministic contention. 11 self-tests prove its semantics.
- `api/cron/mandateIntegrationHarness.test.js` — drives the REAL `runEvalSweep`/`runCloseSweep` + real `closeBook` against the fake, covering (a) whole-close-failure durable trace + `MANDATE_CLOSE_FAILED_STREAK` at 2; (b) truthful completion (an errored sweep never claims complete or runs retention); (c) fresh-read-under-lease preventing a within-slot double bill; (d) `no_vintage`→quarantine; (e) two revision writers, exactly one winner (same-date double close → the in-txn `lastCloseKey` re-check + revision precondition yield one row, one bump).
- Enabler: `runEvalSweep`/`runCloseSweep` extracted from the `handler` in `mandate-evaluate.js` as injectable (`db`) exported seams; `handler` stays the thin dispatcher. Mechanical, behavior-preserving (guarded by the full suite + the harness + native-ESM smoke).

**Item 2 — rollover (`api/cron/mandate-rollover.js` + `api/_utils/mandateRollover.js`).**
- `rollOneBoundary` — the §5.3 atomic per-boundary transaction: pre-reads the immutable dailyRows; publishes + Risk-3-asserts the target vintage BEFORE the txn; then in one commit derives the OLD tenure's summary (I4, from tagged rows), `quarterIndex++` / new `quarterKey`, `quarterStartAt` = the logical boundary, `nextRolloverAt` = `computeNextRolloverAt(boundary).at` (the SAME normalizer as creation), re-pins `vintageRef`, resets the tenure lens (`quarterHighWaterMark = totalValue`, drawdown 0), recomputes `cadenceTier` from the new archetype (F23), cancels an open batch (I1), sets `lastProcessedRolloverKey`, bumps `revision`. **FR-1 (`assertCapitalConserved`)** — an M2-safe write-set guard: it inspects the ACTUAL patch and throws if any capital field (cash/positions/totalValue/initialValue/lifetime lens) is present, or if the tenure-HWM reset ≠ the in-txn pre-read total. Bound to a specific `quarterIndex` so a losing/replayed writer skips (`already_rolled`/`not_due`) — idempotent (acceptance #4). `catchUpBook` loops it one boundary/txn, oldest first (F21), `empty:true` for a rowless quarter.
- `runRolloverSweep` — the cursor-paged due-set sweep (see §4 ambiguity 2 for the Firestore reasoning), durable failure trace + `MANDATE_ROLLOVER_FAILED_STREAK`, truthful completion.
- `activeRolloverTick` (`mandateSessionSlots.js`) — the pre-market window `[open−120, open)` ET, disjoint from eval slots + the close window.

**Item 3 — quarterSummaries (`api/_utils/mandateQuarterSummary.js`).** `deriveQuarterSummary(rows, opts)` — pure; filters to `r.quarterIndex === quarterIndex` (FR-2 tags are truth), opening/closing from the tagged edge rows (I4), tenure return + risk metrics via the P3 lens machinery (degraded-row discipline carried), regime + `agencyState` (I10) mixes with `unknown` counted honestly, friction/dividend term totals, `scoring:false` when voided, `empty:true` (never fabricated) for a zero-row range. `buildQuarterSummary` extended (`agencyStateMix`, `frictionTotalUsd`, `dividendIncomeTotalUsd`) at schemaVersion 1.

**Item 4 — escape hatch (`api/mandate/escape.js` + `api/_utils/mandateEscape.js`).** `escapeMandate` — the §5.4 single transaction: preconditions all inside (once-ever `mandateEscapeHatchUsed`, 14-day window, ownership, active); the open batch is CANCELLED not refused (D-3); a terminal NON-SCORING (`scoring:false`, voided) summary on the old book; the replacement fresh at `MANDATE_STARTING_CAPITAL`, `quarterIndex:1`, new archetype/vintage/stable manager (FR-7), NO escape window (once ever); `mandateEscapeHatchUsed:true` + `activeMandateId` flipped in the SAME transaction (F6); both books I-5 cohort-flagged + linked. The endpoint mirrors `create.js` auth minus the founder allowlist (user endpoint; ownership re-asserted in the txn), dark 404 behind the master.

**Item 5 — accelerated-clock harness (`api/_utils/mandateAcceleratedClock.js` + `api/mandate/accelerate.js`).** Founder-gated dark endpoint driving the REAL cores through fast-forwarded (backdated-creation) scenarios: full rollover (capital carried, lens reset, vintage re-pinned, row-derived summary), the FR-1 assertion OBSERVED FIRING on an injected violation, a two-boundary catch-up with `empty:true`, and an escape reset — the machinery §9's acceptance run uses. Returns structured observations (never asserts internally).

**Tests:** the full repo suite is **7,862 passed / 0 failed** (62 net new); `vite build` ✓; native-ESM smoke covers all 4 mandate routes; protected-store scan 9/9.

---

## 2. Pass 1 — findings (four adversarial reviewers)

<!-- FILLED AFTER THE REVIEW WORKFLOW -->

## 3. Pass 2 — verification (refute-with-repro) and dispositions

<!-- FILLED AFTER THE VERIFICATION PASS -->

---

## 4. Ambiguities and readings chosen (for founder review)

1. **The rollover pre-market window.** §5.3 says "second slot, daily pre-market." Read as `activeRolloverTick` = `[open − MANDATE_ROLLOVER_PREOPEN_MIN (120), open)` ET on a trading day — disjoint from eval slots (which start at open+30) and the post-close window by construction. Correctness rests on the idempotent `nextRolloverAt <= now` query + `lastProcessedRolloverKey`, not the window; the window only pins WHEN the (P6-registered) cron fires.
2. **The rollover sweep's "attempt-marker discipline" under an inequality filter.** The close sweep orders by an attempt marker so a stuck book rotates behind the frontier. Rollover filters `nextRolloverAt <= now`, and Firestore requires the inequality field to be the FIRST orderBy — so an attempt-marker primary order is impossible. Reading chosen: a **cursor walk** over `(nextRolloverAt ASC, __name__)` — it reaches every due book in a fire regardless of failures (the cursor steps past a stuck book), gives the same "no pinning, no vanishing" guarantee, keeps catch-up priority (oldest-first) correct, and reuses the existing `status+nextRolloverAt` index (no new index). A durable failure trace (`consecutiveRolloverFailures` + `MANDATE_ROLLOVER_FAILED_STREAK`) gives the same observability. **Documented residual:** a systemic per-cohort rollover failure at the OLDEST boundary can delay younger cohorts within a fire — non-destructive (books keep trading/marking; the close sweep is independent; they simply don't advance quarter), loudly alerted, and the correct oldest-first priority.
3. **Escape flag posture.** The §7 flag list has no dedicated escape flag. Reading: escape is gated by the `MANAGED_MANDATE_ENABLED` master (it can't be used before the system is live); token auth + in-txn ownership make it non-exploitable even after the master flips for dark acceptance. No new flag → no flag-pin-guard churn.
4. **Accelerate endpoint gate.** Founder/dev machinery → gated on the existing `MANDATE_FOUNDER_CREATE_ENABLED` + allowlist (same contract as `create.js`), reusing `isFounderAuthorized`/`founderAllowlist`. No new flag.
5. **The FR-1 assertion as a write-set guard (M2-safe).** `assertCapitalConserved` is not `x===x`: it inspects the actual rollover patch and throws on any capital-mutating key or a tenure-HWM reset ≠ the independent in-txn pre-read total. A future edit that added a capital write, or reset the lens to a fabricated peak, fires it. The `patchMutator` seam lets the accelerated harness observe it firing end-to-end.
6. **Summary boundaries.** `deriveQuarterSummary` takes optional `quarterStartAt`/`quarterEndAt`; the rollover passes the logical boundary instants (`book.quarterStartAt`, `book.nextRolloverAt`) and escape passes `now` — all I4 logical/authoritative values, never a processing-time read. Opening/closing values always come from the tagged edge rows.
7. **Transaction-faithful fake vs the emulator** — stated in Item 1 above; the fake is the substrate choice with its rationale.
8. **The seam extraction** of `runEvalSweep`/`runCloseSweep` from the handler — a mechanical, behavior-preserving change to merged P3 code to make the sweeps testable (the whole point of paying the harness debt). Guarded by the full suite, the new harness, and the native-ESM smoke. The two eval-sweep lease call sites moved `handler → runEvalSweep` in the protected-store allowlist accordingly.
9. **`tenureReturn` units.** Stored as a percent (from `computeTotalReturnPct`), consistent with the risk metrics' `totalReturnPct`.
10. **The archetype-change parameter exists but is never called with a different archetype in production** — `rollOneBoundary`/`catchUpBook` accept `archetype` (DEF-1's future re-choose attaches here without touching mechanics); V1 always continues the same archetype. A different archetype changes `archetype`/`managerAgentId`/`vintageRef` and NOT capital (FR-1), verified by test.

---

## 5. Protected-store scan (standing rule, handled in-PR)

Resolvability checked first. All 9 new write sites resolve to `::unresolved` (transaction-handle `tx.set`/`tx.update` writes on `mandateRef`-rooted / `docSnap.ref` DocumentReferences — the scanner cannot trace handle-form ref arguments; the atomic §5.3/§5.4 transactions must not be restructured to inline a literal). **Write-target statement:** every new site targets `mandates/{id}` (rollover/escape update + escape new-book create), its subcollections `quarterSummaries` (tenure record) and `decisions` (the I1 open-batch cancel), and `userMeta/{uid}` (escape's F6 once-ever flag + active pointer) — **none is in `PROTECTED_COLLECTIONS`** (that set is composition/agent-forge surface only). Allowlisted at pinned counts with a `_notes_spec1_phase4` block. Two stale keys (`mandate-evaluate.js::handler::call:acquireLease#1`/`releaseLease#1`) were pruned and re-listed under `runEvalSweep` after the seam extraction — same writes, same non-protected target (`mandates/{id}.lease`). Scan is 9/9 green (deny-by-default + no drift + no stale).

---

## 6. Flagged for P5 / later phases (known boundaries, not defects)

- **Batch transport (P5)** — `openBatchId` is always null under direct transport, so the open-batch cancel path in both rollover and escape is built (I1-correct) but dormant; P5's batch transport activates it.
- **Cron registration (P6)** — `api/cron/mandate-rollover.js` has no `vercel.json` entry; registration + preview smoke + the acceptance run are P6. Crons don't run on preview, so verification here = unit tests on the logic + the first production run.
- **Re-choose UI / attribution displays (DEF-1/DEF-2)** — the archetype-change parameter exists; no UI or re-choose experience is built.
- **The rollover cursor-walk residual (ambiguity 2)** — the systemic-oldest-cohort-failure delay is a monitoring concern for the acceptance run, surfaced by `MANDATE_ROLLOVER_FAILED_STREAK`.
- **I-5 cohort flags** — escape stamps `escapeCohort`/`escapeReplacementOf`/`escapeReplacedBy`; the I-5 experiment that consumes them is a later spec.

---

## 7. Verdict

<!-- FILLED AFTER THE VERIFICATION PASS -->
