# Mandate Substrate — Phase 3 cumulative adversarial review

**Date:** 2026-08-12
**Branch:** `claude/phase-3-mandate-substrate-nxubz3` (cut from `origin/main` at `d097bd6f`, post-#745/#746/#747)
**Scope:** Phase 3 of 6 — the honesty phase (§3.6–§3.7, §4.1–§4.3, §6.1–§6.4). 34 files, ~3,260 insertions.
**Spec:** `docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md` · **Charter:** `docs/QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_2.md`
**Method:** the Phase-1/2 pattern — four independent adversarial reviewers (money/friction-entry, C-21/gap-detector-and-quarantine, architecture-invariants/two-revision-writers, spec-faithfulness/partial-rows-and-lenses), each instructed to *assume a defect exists* in its target mechanism, then an independent verification pass instructed to **refute** every finding with a concrete repro. Diff exceeds both §2 thresholds (≥10 files / ≥1500 lines), so the review was mandatory.

---

## 0. Step 0 — abbreviated drift check (per the kickoff)

`git fetch origin` run first (BUILD_RULES §3); branch cut from current `main` (`d097bd6f`, 0 behind).

| # | Item | Verdict |
|---|---|---|
| 1 | Phase 2 modules unchanged since the #745 merge | **CLEAN.** `git diff --stat 625d4cbc..HEAD -- 'api/_utils/mandate*' 'api/cron/mandate*' 'api/_utils/__fixtures__/mandate*'` at session start → empty. The two post-#745 merges (#746 Doug universe expansion, #747 D4 sector memo) touch no mandate file. |
| 2 | `shadowLogger.appendToStream` signature + awaited-and-checked pattern | **CLEAN.** `appendToStream(stream, record)` resolves to a boolean, never throws (`shadowLogger.js:44`, contract at `:6-14`); the callers-that-must-prove-persistence pattern (WS1 rule_compat precedent) is unchanged. Streams are exposed via exported wrappers — the dual-label stream follows the house pattern with a new `logMandateScoring` wrapper. |
| 3 | `indexIntelligence/marketContext` shape + cadence | **CLEAN.** Writer `compute-index-intelligence.js:970-995`: `regime` (string), `regimeDetail`, `updatedAt` (serverTimestamp) + context fields. Cadence: premarket 2× (`30 10,11 * * 1-5`) + hourly intraday (`0 14-20 * * 1-5`) — every close-pass timing sees a same-session write well inside the 6h max age. `regimeStamp.js` (`REGIME_STAMP_SOURCE`, `:50`) confirmed as the house read pattern; P3's `mandateRegime.js` mirrors its stale⇒unknown posture. |
| 4 | EODHD splits/dividends endpoints reachable from existing client config | **CLEAN, with an environment caveat.** A live probe is impossible from this sandbox (the agent proxy returns 403 CONNECT for eodhd.com — a network-policy limit of the build environment, not an account limit). Structural verification: the endpoints share the exact host + `api_token` auth scheme with **ten** endpoint families in production use (`/api/eod` ×18, `/api/real-time` ×16, `/api/calendar` ×11, `/api/fundamentals` ×8, …), and splits/dividends belong to the same EOD-Historical-Data product family as `/api/eod`. Mitigation built in: the fetcher fails LOUDLY per symbol (`caFetchFailed` markers + `MANDATE_CA_FETCH_DEGRADED` alert), the daily doc records honest CA coverage, and the §4.3 gap detector is the independent backstop — plan-unavailability would surface observably on the first production slow-layer build, never as a silent mismark. |

No load-bearing drift. Pre-ruled staleness honored: built to `MANDATE_STARTING_CAPITAL` = $10,000,000 (D-43); spec §9 rows 5/10's "$100K" not edited.

---

## 1. What was built (the 8 kickoff items + scaffolding)

| # | Item | Module(s) |
|---|---|---|
| 1 | Daily close pass (§3.6) — the centerpiece | `mandateClosePass.js` (`closeBook`, `deriveAgencyState`, `appendScoringWithRetry`, `trailingLivenessRatio`, `healthAlertsAfterClose`, `runRetentionCleanup`), close-duty window `mandateSessionSlots.activeCloseTick`, sweep driver `mandate-evaluate.js::runCloseSweep` |
| 2 | Friction model (§4.1) | `mandateFrictionModel.js` (cap tiers from the daily layer's marketCap; fail-conservative unknown tier), wired as `computeExecution`'s default — friction enters exactly once, at execution, through cash (F14); `MANDATE_FRICTION_MODEL_VERSION = 'p3_cap_tier_v1'` |
| 3 | Risk metrics, both lenses (§4.2) | `mandateRiskMetrics.js` — warmup nulls (20/20/5), null-on-degenerate preserved from the Q4-verified season contract (+ float-noise hardening), I6 partial-row discipline, FR-2 lens separation over row `quarterIndex` tags, renormalized composite with contributors recorded |
| 4 | Corporate actions (§4.3, FR-4) | `mandateCorporateActions.js` (pure: parsers, `pendingActionsFor`, `applyCorporateAction`, `classifyOvernightGaps`/`isRatioShaped`) + the EODHD splits/dividends fetch in the slow layer (`mandateUniverseSnapshot.fetchCorporateActionsEODHD`, `ensureDailySnapshot` extension, per-symbol denormalization onto tick snapshots) |
| 5 | Dual-label stream (O-11, I14) | `shadowLogger.logMandateScoring` wrapper; awaited-and-checked append post-close; durable `pendingScoringAppends/{date}` markers consumed by the next close (`appendScoringWithRetry`); `captureReceipt` untouched |
| 6 | Regime + provenance (§6.1, I-7) | `mandateRegime.js` (`resolveRegime`: stale/absent/unprovable ⇒ `'unknown'`, never silently stale); one source read per handler fire; rows carry `regime`/`regimeAsOf`/`regimeSource`; P2's context-block placeholder now wired to the same resolved value |
| 7 | Health, quarantine, liveness (§6.4, I2, I9) | Quarantine flip at 5 consecutive failures → exit-only mode (tool schema restricted via `effectiveVerbs`, gate `quarantined` check, prompt honesty note; still swept, still closed daily); `execState.staleRejectStreak` (THE liveness wire per the P2 ruling) + `MANDATE_STALE_STREAK_ALERT`; `executedVsSubmitted` trailing-window floor (secondary); missed-marks ≥2 alert; open-batch auto-expiry to terminal `expired` with gate cleared (I1) |
| 8 | Cost telemetry completion (§6.2/6.3, I-6) | `modelPriceTable.js` (versioned $/MTok; unknown model ⇒ null estUsd + alert, never a silent $0); `telemetryPatch` month/day accumulation; per-day tokens/estUsd/evalCount/cacheHitTokens onto daily rows; `MANDATE_RUNRATE_EXCEEDED` above the D-22 band |

Plus: the I7 gap detector wired into the EVAL path (frozen symbols excluded from the valuation basis so the manager never reasons over — or fills at — a phantom mark; exits fill at last-good per the ratified C-21 path), retention (§3.7, 120-day snapshot cleanup piggybacking the completed close sweep), `firestore.rules` (`pendingScoringAppends` internal), the close-sweep composite index, and the §8 fork-ledger realization note for the season risk-math fork. Everything ships **dark**: the close duty is behind `MANAGED_MANDATE_ENABLED && MANDATE_CLOSE_ENABLED` (both `false`, pre-existing pins unchanged); no `vercel.json` change (P6).

**Tests:** 262 mandate-family unit tests pass (all suites); full repo suite **7,770 passed / 0 failed**; `vite build` ✓ (BUILD_RULES §2). The battle honesty suite, flag-pin guard, archetype ratchet, `wireModelCall` sole-importer, and both mandate sole-importer scans stay green (no cross-coupling).

**Self-review findings (fixed before the reviewers ran):**
- `usableReturns` coerced a null `dayReturnPct` through `Number(null) === 0`, silently recording a flat day in variance metrics — a first-ever close row would have poisoned Sharpe. Fixed: null returns are excluded, with a test.
- The season-forked exact `sd === 0` degeneracy check misses ~1e-18 float noise on identical-return series, printing an astronomically large Sharpe — exactly the flattering number §4.2 forbids. Fixed with a relative-epsilon test, documented in the §8 fork ledger.
- The §3.5 conservation invariant fired on a correct CA-frozen exit: the pre/post valuations used the phantom (already-adjusted) fresh mark while the fill correctly used last-good. Fixed: the execution boundary's valuation basis excludes CA-frozen symbols (`snapshotExcluding`) — "one consistent valuation" must be consistent *with the fill basis* — and the eval path passes the same basis to the prompt and the gate, so the manager never sees the phantom either.

---

## 2. Pass 1 — findings (four reviewers)

<!-- FILLED AFTER THE REVIEW PASSES -->

## 3. Pass 2 — verification (refute-with-repro) and dispositions

<!-- FILLED AFTER THE VERIFICATION PASS -->

---

## 4. Ambiguities and readings chosen (for founder review)

1. **The close-duty window.** §3.6 says the close pass "runs on the final eligible tick of each trading session" and calls it "the eval handler's post-close duty" marking "the session's official close." The final *eval* slot (preClose) ends AT the close with intraday marks, so a literal reading cannot produce official-close marks. Read as: a distinct post-close window `[close+15m, close+120m)` inside the same handler (no new cron, no vercel.json change — registration is P6), building a dedicated `${date}_close` snapshot whose quotes carry the official close print. The 15-minute settle delay and 105-minute width are provisional constants (`MANDATE_CLOSE_DELAY_MIN`/`MANDATE_CLOSE_WINDOW_MIN`); the window derives from the calendar's `closeMin`, so early-close days shift automatically, and the geometry guarantees no wall-clock overlap with eval invocations (correctness rests on revision-preconditioned transactions regardless).
2. **agencyState is derived at close from end-of-session state.** A book quarantined mid-session records `exit_only` for the whole session's row; `skipped:<reason>` reasons are a small closed set (`created_intraday`, `eval_failure`, `not_evaluated`). `'frozen'` remains in the §2.2 enum but no P3 mechanism produces it (C-21 forbids a full administrative freeze) — documented in `deriveAgencyState`.
3. **Friction tier values.** The spec pins the *mechanism* (bps by cap tier) but no numbers. Provisional: mega ≥$200B → 1+2bps; large ≥$10B → 2+3; mid ≥$2B → 3+7; small/unknown → 5+15 (unknown = widest, fail-conservative: degraded data never buys cheaper fills). Founder-tunable in one config block, version-stamped on every receipt.
4. **Liveness floor and window.** §6.4 names `MANDATE_LIVENESS_FLOOR` with no initial: 0.5 over a 10-row trailing window, computed from cumulative counters snapshotted on rows; null (no alert) under 5 window submissions. Subordinate by design to the stale-rejection streak per the P2 founder ruling (HOLD counts as executed, so the ratio is a coarse secondary signal).
5. **Dividend timing.** Cash dividends credit at the ex-date's close using shares held at application time (§4.3's literal "cash += shares × amount"). A manager trading intra-session on the ex-date shifts the credited quantity — documented V1 approximation; the row records the income separately from trading P&L either way.
6. **Delisting/ticker-change sourcing.** EODHD's splits/dividends endpoints (the only CA feed the account has, Q5) do not carry delistings or ticker changes. The applier fully supports both types (FR-4) and the close pass executes them when action docs exist (founder-inserted or a future feed); automated *detection* is deliberately not built — the missed-marks ≥2 alert surfaces stuck symbols to the founder instead of risking a long-halt being auto-liquidated as a false delisting.
7. **Gap-detector bands.** Threshold 0.40 (earnings gaps -10–30% pass by construction) with ±1.5% relative ratio tolerance on n and 1/n, n=2..10. A news crash landing within 1.5% of an exact split ratio (e.g. −50.0%) freezes falsely — accepted residual, self-limiting (exits stay fillable at last-good; the close-pass partial row + missed-marks alert route it to the founder), vs. the alternative of a real ÷10 split mis-executing at 10× phantom value. Non-integer split ratios (3:2) with no feed entry pass undetected — bounded by the feed cross-check catching FEED-KNOWN splits of any shape; noted for founder awareness.
8. **`dayReturnPct` on the first-ever row is null** — an honest "cannot compute" rather than a multi-session return dressed as one day. Metrics exclude null-return rows from variance; the row still counts for drawdown.
9. **Daily-row shape additions at schemaVersion 1.** The P3 row carries more fields than the P1 factory sketch (dividend income, day/cum friction, cumulative liveness counters, `degradedMarks`, `cacheHitTokens`). No row was ever written before this phase (the close pass is the first writer; flags dark), so the richer shape IS v1 — no version bump, no migration.
10. **Scan-test timeout.** The protected-store scan's full-repo AST walk sat at the 5s default per-test timeout margin under full-suite load; P3's added files pushed one of its tests over intermittently. Gave that one test an explicit 20s timeout with a comment — test infra, not behavior.

---

## 5. Protected-store scan (standing rule, Part 3 of the P2 close-out)

The scan fired exactly as designed on the new close-path write sites. Resolvability first: the `dailyRows/{date}` row write and the `pendingScoringAppends/{date}` marker write resolve through visible collection literals to non-protected stores (the latter needs no entry; the former's `mandateRef`-parameter-rooted chain defeats static resolution and is pinned instead). **Allowlisted (5 keys, pinned counts, per-entry notes in `_notes_spec1_phase3`):**

| Site | Verified write target(s) | Protected? |
|---|---|---|
| `mandateClosePass::closeBook` (set ×2) | `mandates/{id}/decisions/*` (expiry + CORPORATE_CLOSE receipts) + `mandates/{id}/corporateActions/{actionId}` via the deferred-write loop; `mandates/{id}/dailyRows/{date}` | no |
| `mandateClosePass::closeBook` (update ×1) | `mandates/{id}` (marks/peaks/scoring/health/execState under revision discipline) | no |
| `mandate-evaluate::runCloseSweep::call:acquireLease#1` / `call:releaseLease#1` | the `lease` field on `mandates/{id}` (P2-covered callees; ref = sweep query `docSnap.ref`) | no |
| `mandate-evaluate::runCloseSweep::call:closeBook#1` | one-hop into the closeBook writes above | no |

None touches a composition-protected store. This statement is the human review the guard demands. Scan re-run: **9/9 green.**

---

## 6. Flagged for P4 (known phase boundaries, not defects)

- **quarterSummaries** are still never written; the close pass computes lens metrics from row tags so P4's rollover derives summaries from tagged rows exactly as I4 prescribes. `consecutiveMissedMarks` and `staleRejectStreak` now exist in the health/exec blocks P4's rollover transaction must carry through unchanged.
- **Open-batch expiry** is built and tested via the close pass; under direct transport it is rarely reachable (submit and harvest share a tick). P5's batch transport inherits the disposition path as spec'd (I1).
- **`cacheHitTokens`** plumbed end-to-end, permanently 0 until P5 wires prompt caching.
- **Regime for the eval-path prompt** resolves per fire; the close pass resolves independently per fire. Both stamp `'unknown'` on staleness — P4/P5 change nothing here.
- **Retention** covers the two snapshot collections; terminal *batch* bookkeeping (30 days) activates with P5's batch docs.

---

## 7. Verdict

<!-- FILLED AFTER THE VERIFICATION PASS -->
