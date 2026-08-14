# Spec 1 — The Mandate — Acceptance Report V1 (§9 Founder Bar)

**Status:** ACCUMULATING. This report is the §9 acceptance checklist. It is filled in two waves: the **harness wave** (the machinery that produces every acceptance outcome, proven green now, in-repo, dev/emulator — Phase 6 Part E) and the **live wave** (the ≥10-market-day founder-observed dark run — Phase 6 Parts C/D, which cannot occur in a build session: crons don't run on preview, and the batch window is calendar-bound to include Fri Sep 4, 2026 pre-Labor-Day).
**Rule (spec §9):** *Red anywhere = not done. The bar is the bar.* A criterion is GREEN only when its evidence is recorded here.
**Basis:** spec `docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md` §9; charter `docs/QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_2.md`; ops `docs/MANDATE_RUNBOOK.md`.
**Capital note:** §9 criterion #5 prints "$100K"; **D-43 governs — `MANDATE_STARTING_CAPITAL = $10,000,000`** (`api/_utils/mandateConfig.js:27`). The "$100K" is the pre-ruled-stale figure (P5 kickoff standing rule); the harness asserts $10M.

---

## Executive verdict (read this first)

| # | §9 criterion (one line) | Machinery (harness) | Live run | Overall |
|---|---|---|---|---|
| 1 | All six archetypes run books dark ≥ 10 market days | ✅ built + creation path proven | ⏳ needs the ≥10-day run | ⏳ **PENDING-live** |
| 2 | ≥ 5 days in `batch` transport incl. a Friday + a pre-holiday session | ✅ transport proven | ⏳ needs the batch window (Aug 24–Sep 4 plan) | ⏳ **PENDING-live** |
| 3 | Every active book has a dailyRow for every session (zero gaps, slow incl.) | ✅ close pass writes all tiers incl. partials | ⏳ needs the run's row census | ⏳ **PENDING-live** |
| 4 | Injected failure cases (6 of them) all pass | ✅ **all six proven green** | — replayed live optional | ✅ **GREEN (harness)** |
| 5 | Accelerated-clock: rollover carry / two-boundary catch-up / escape reset | ✅ **all three proven green** | — (harness IS the criterion) | ✅ **GREEN** |
| 6 | Measured model spend + measured upstream request counts vs §6.3 envelope | ✅ telemetry plumbed end-to-end | ⏳ needs measured numbers | ⏳ **PENDING-live** |
| 7 | A corporate action applied to a live position + news-gap passes + ratio-gap quarantines | ✅ split + both gap classes proven | ⏳ real/synthetic dividend on a live book | 🟡 **GREEN core / live confirm** |
| 8 | Batch turnaround distribution recorded; exec/submit ratio > floor; late batch → expired → eligible | ✅ late-batch path proven; stats doc plumbed | ⏳ needs the batch-day distribution | 🟡 **GREEN core / live confirm** |
| 9 | Every dailyRow carries correct agencyState incl. a forced exit_only day (SELL fills, BUY blocked); tenure aggregates | ✅ exit_only + agencyState derivation + aggregation proven | ⏳ needs the run's per-row census | 🟡 **GREEN core / live confirm** |
| 10 | Zero-gap amended (I17): escape-replacement books owe a creation-day `partial:true` row then full rows | ✅ creation-day partial proven | ⏳ needs a live escape in the run | 🟡 **GREEN core / live confirm** |

**Verdict:** the substrate's **machinery is acceptance-green today** — every outcome §9 demands is produced and proven by the in-repo harness (160 mandate harness tests, 0 failed). What remains is the **live wave**: run the population ≥10 market days (≥5 in batch, incl. Fri Sep 4), and paste the run's measured evidence into the ⏳ rows. Spec 1 is done when this table is all ✅.

---

## The harness wave (Phase 6 Part E) — proven green, this build

Run: `npx vitest run api/_utils/mandateAcceleratedClock.test.js api/_utils/mandateRollover.test.js api/_utils/mandateEscape.test.js api/cron/mandateIntegrationHarness.test.js api/cron/mandateBatchInterleavings.test.js api/_utils/mandateBatchTransport.test.js api/_utils/mandateClosePass.test.js api/_utils/mandateCorporateActions.test.js api/cron/mandate-evaluate.test.js api/cron/mandate-rollover.test.js api/mandate/create.test.js api/mandate/drain.test.js` → **160 passed / 0 failed** (12 files).

### #4 — Injected failure cases (GREEN, all six)

| Injected case | Proven by | Outcome asserted |
|---|---|---|
| Duplicate harvest of one batch executes **once** | `mandateBatchInterleavings.test.js` "(b) … the re-harvest no-ops on the claim: one execution, one bill, batch doc converges"; `mandateExecution.test.js:230` "is exactly-once: a replay of the same decisionId no-ops (F2)" | one execution, one bill, no double-mutation |
| Stale `baseRevision` **rejected**, not applied | `mandateBatchTransport.test.js:259` "a result whose baseRevision is stale is rejected_stale — discarded, never adapted (streak++, gate cleared)" | `rejected_stale`/`base_revision`, no money moves |
| Cross-session result **rejected** | `mandateBatchTransport.test.js:277` "a CROSS-SESSION result is rejected_stale (F3) even when everything else matches" | `rejected_stale`/`cross_session` |
| Missing held symbol → **skip + flagged partial close**, not a bad mark | `mandateClosePass.test.js:216` "PARTIAL close (I11/F19): an unmarkable held symbol → carry-over mark, partial row, missedMarks++" | `partial:true`, `markSource:'carry_over'`, no stale value recorded as truth |
| Mid-flight crash → **no partial mutation** | `mandateIntegrationHarness.test.js` "(e) two revision writers on one doc — exactly one winner" (revision-preconditioned txn; loser retries against winner's state) | atomic; no partial commit; exactly one row + one revision bump |
| Rollover replayed twice → **one summary** | `mandateRollover.test.js:148` "a replay after the boundary advanced is skipped:not_due — exactly one summary"; `:210` "two fires on the same boundary → one rolls, the other skips" | exactly one `quarterSummary`, one advance |

### #5 — Accelerated-clock lifecycle (GREEN, all three) — `mandateAcceleratedClock.test.js`

| Item | Proven by | Asserted |
|---|---|---|
| Full rollover, capital carried + quarter-lens reset | "rolls a backdated book and observes FR-1 carry + lens reset + row-derived summary"; **FR-1 assertion OBSERVED FIRING on an injected violation** ("FR-1 assertion observed FIRING on an injected violation") | `totalValue` unchanged across the boundary (transaction-asserted, I15); quarter HWM/drawdown reset; summary derived from tagged rows |
| Two-boundary catch-up incl. an empty quarter | "processes two boundaries oldest-first, carrying capital, with quarter 2 empty:true" | oldest-first; `empty:true` never fabricated (F21) |
| Escape hatch: reset to **$10M**, `voided:true`, non-scoring, once-ever | "voids the old book, resets the replacement to starting capital, sets the once-ever flag" | replacement at `MANDATE_STARTING_CAPITAL` ($10M); old book `voided:true` + `scoring:false` summary; `mandateEscapeHatchUsed` once-ever |

### #7 core — Corporate actions (GREEN core) — `mandateCorporateActions.test.js`, `mandateClosePass.test.js`

- Split applied before marking: `mandateClosePass.test.js:251` "applies a pending SPLIT before marking (§4.3): shares × ratio, basis unchanged, CA log written, idempotent next day".
- Ratio-shaped gap → symbol-level suspected-CA (carry-over, book never frozen): `mandateClosePass.test.js:308` "a suspected-CA gap at close (ratio-shaped, no feed) keeps the carry-over mark and flags the row"; news-shaped gaps pass through (`mandateCorporateActions.test.js` gap-classifier suite). **Live confirm:** a real or synthetic **dividend** on a live 15-position book during the run (§9 #7).

### #8 core — Late batch (GREEN core) — `mandateBatchTransport.test.js`

- `mandateBatchTransport.test.js:359` "LATE BATCH (I9/I1 acceptance-critical): age-out → dispositions + gate cleared NOW; the doc waits, then the late result BILLS (never executes) and finalizes expired". The book returns to submit-eligibility immediately (I1); the injected late batch reaches `expired`. **Live confirm:** the submit→result **distribution** across batch days (`mandateBatchStats/{date}`) and the run-wide executed-vs-submitted ratio > `MANDATE_LIVENESS_FLOOR` (0.5).

### #9 core — Agency record (GREEN core)

- Forced exit_only day: `mandate-evaluate.test.js:155` "a QUARANTINED book: the tool schema is restricted and a smuggled BUY dies as bad_decision" + `:172` "a quarantined book still EXITS freely (C-21): SELL executes" — **a SELL executes and a BUY is blocked** on the same quarantined book.
- `agencyState` derivation per row (`mandateClosePass.js:108 deriveAgencyState`) and tenure aggregation (`mandateQuarterSummary.js:82 agencyStateMix`) are unit-proven. **Live confirm:** every acceptance dailyRow carries a correct `agencyState`, and the tenure summary aggregates them.

### #10 core — Escape-replacement creation-day row (GREEN core)

- `mandateClosePass.test.js:233` "creation-day close (I17): partial:true row, skipped:created_intraday, null dayReturnPct" — an intra-session-created book writes a `partial:true` creation-day row; full rows begin the next full session. **Live confirm:** a live escape during the run, then its row series.

---

## The live wave (Phase 6 Parts C/D) — procedure + where the evidence lands

> These run on the deployed, flag-lit, founder-only system over ≥10 market days. Each row below states **the exact query/observation** that fills it. See `docs/MANDATE_RUNBOOK.md` for the activation sequence and daily-check guide.

### #1 — Six archetypes, ≥10 market days
- **Setup (Part C):** after flip PR #1 + redeploy, create one mandate per archetype via the founder endpoint (`POST /api/mandate/create`, body `{archetype}`, Firebase-authed founder uid) — all six: `analyst, guardian, contrarian, diversifier, momentum_chaser, degen` (spans all three cadence tiers). Verify per book: `vintageRef` pinned, `portfolio.cash === 10_000_000`, `quarterIndex:1`. Creation-day intra-session → `partial:true` row at that day's close (I17).
- **Evidence to record:** the six `mandates/{id}` docs (userId=founder, status active, distinct archetypes) and a session count ≥10 from the first full session to the last. Slow-tier books (analyst, guardian) included.

### #2 — ≥5 batch days incl. a Friday and a pre-holiday session
- **Setup (Part D):** flip `MANDATE_TRANSPORT_MODE='batch'` (config PR-D) for a window that includes **Fri Sep 4, 2026** — the session before Labor Day (Mon Sep 7). That single session satisfies BOTH "a Friday" AND "followed by a market holiday." Suggested plan: **direct** Aug 17–21, **batch** Aug 24–Sep 4 (≥5 batch days: Aug 24–28 + Aug 31–Sep 4).
- **Evidence to record:** ≥5 dates with `mandateBatchStats/{date}` docs; Sep 4 present; the calendar confirms Sep 7 is a NYSE holiday (`api/_utils/marketSchedule.js`).

### #3 / #10 — Zero-gap dailyRows (slow tier included; escape-replacement partial then full)
- **Evidence to record:** for every active book, `mandates/{id}/dailyRows/{YYYY-MM-DD}` exists for every trading session in the window — **zero gaps**. `partial:true` only where honestly flagged (carry-over marks / creation day). Slow-tier books have the same row coverage as fast (the close pass is model-cadence-independent). If an escape is exercised: the replacement's first row is `partial:true` (creation day), full rows thereafter (I17).

### #6 — Measured model spend + measured upstream counts vs §6.3 envelope
- **Evidence to record:** (a) **model spend** — per book `costTelemetry.estUsd` / `tokensIn` / `tokensOut` (monthly accumulator) and per `dailyRow.estUsd`; also `cacheHitTokens` / `cacheWriteTokens` / `unpricedCalls`. (b) **upstream counts** — `mandateUpstreamCalls/{date}` daily counter. Compare to the §6.3 reference envelope (~$0.0075/eval; per-book-month ≈ $0.16 slow / $0.32 standard / $0.63 fast; upstream well under the daily ceiling). **Measurement is the criterion — matching the estimate is not** (§6.3). Any `MANDATE_UNPRICED_SPEND` / `MANDATE_RUNRATE_EXCEEDED` alerts noted.

### #8 live — Turnaround distribution + ratio
- **Evidence to record:** for each batch day, the submit→result latency distribution from `mandateBatchStats/{date}` (`turnaroundMs` / `harvestLagMs` per batch). Compare the distribution against the session-slot gaps (open30→midday ≈ 2h45m, the 4h `MANDATE_RESULT_MAX_AGE_MS` ceiling). Run-wide `executedVsSubmitted` > `MANDATE_LIVENESS_FLOOR` (0.5) — read with the counter-asymmetry caveat (runbook: the **stale-rejection streak** is the primary wire). This is the **Risk-7 instrument** — the number that judges whether batch transport is viable or direct is the launch posture.

### #7 live — A real corporate action on a live position
- **Evidence to record:** a split or dividend applied to a held ticker during the run (real if one occurs across six 15-position books in a fortnight — likely a dividend; synthetic via a founder-inserted action doc otherwise — see runbook "Cash-merger / corporate-action insertion"). The applied `corporateActions/{actionId}` log + the position/cash effect + (dividend) the `dailyRow.dividendIncomeUsd`.

### #9 live — Per-row agencyState census + forced exit_only day
- **Evidence to record:** every acceptance `dailyRow.agencyState` ∈ `{full, exit_only, frozen, skipped:<reason>}` and correct for the book's state that session; one **injected exit_only day** (quarantine a book by driving `consecutiveEvalFailures ≥ 5`, or set `health.quarantined:true`) during which a SELL executes and a BUY is blocked; the tenure `quarterSummary.agencyStateMix` aggregates the run. Restore per runbook (the two-field operation).

---

## Closing recommendations (to be written from the live data — Phase 6 Part F)

Two P6-born rulings the acceptance data must inform; both are **founder decisions**, recorded here once the numbers exist:

1. **Transport-mode production posture (Risk 7).** Batch halves per-eval cost but adds latency; direct is the permanent, fully-supported fallback (nothing made it second-class). The `mandateBatchStats` turnaround distribution vs the session windows + the executed-vs-submitted ratio decide whether the launch posture is `batch` or `direct`. → *Verdict pending live #8.*
2. **The 4h `MANDATE_RESULT_MAX_AGE_MS` constant.** If turnaround routinely lands well under the open30→preClose gap (5h30m), the constant is safe; if the open30 batch's single in-window harvest slot (midday) proves too tight, raising the constant adds the preClose window (trades staleness tolerance for liveness). → *Verdict pending live #8.*

*Report reopens for the live wave; Spec 1 completes when every executive-verdict row is ✅.*
