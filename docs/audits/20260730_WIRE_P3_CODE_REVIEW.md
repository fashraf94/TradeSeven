# FANTASYTIMES WIRE — PHASE 2 P3 CODE-REVIEW RECORD

**Date:** July 30, 2026 · **Branch:** `claude/fantasytimes-phase2-p3` · **Diff reviewed:** `git diff origin/main...HEAD` (43 files, ~15k insert / 1.9k delete — the largest diff of the phase, N0→N5) · **Fix-forward commit:** `0603a763`

**Method:** UltraCode all-Opus adversarial review — 7 diverse finder dimensions (correctness · spec-fidelity · state-concurrency · boundaries-security · test-integrity · cross-module-integration · completeness-holes) → 3 perspective-diverse refuters per finding (mechanism / scope / test-coverage lenses, confirm on 2-of-3 majority) → completeness critic + verify pass. **32 agents, 0 errors, ~2.36M subagent tokens.** The two founder-ratified interpretations (signed-deviation referent; categorical-inversion critical partition) were fenced off as non-findings.

**Outcome:** 8 raw findings → **6 confirmed → 3 distinct defects** after dedup → all 3 fixed forward. 2 findings killed by adversarial verify (dispositions below). Completeness critic surfaced 0 new confirmed findings — the seven dimensions were exhaustive.

---

## EXECUTIVE VERDICT

The review found **one real HIGH bug** — the revenue tolerance was ~20-100× too tight, which would have spuriously failed the editorial gate on correct Doug recaps — plus a MEDIUM defensive gap and a LOW observability inaccuracy. All three are fixed, each with a regression test proven red under the pre-fix code. The HIGH was found **independently by four of the seven dimensions**, which is why the verify pass confirmed it unanimously. Nothing touched a GENERATION_SURFACE member, so no version bump. Full sweep 6,600 green, rules suite green. **One item needs your ruling** (the print tolerance, §6 FINAL-LOCK interpretation) before it could ever matter — recorded below; it does not block the dark merge because all five flags are false.

---

## CONFIRMED → FIXED (3)

### 1. HIGH — revenue_vs_consensus band relative to the deviation, not the level
`api/_utils/wireEditorialAdapters.js` · found by correctness, spec-fidelity, test-integrity, completeness-holes (4 dimensions).

§6 records the revenue tolerance as "±0.5% relative" with the rationale "0.5% covers two-sig-fig rounding of **billions**" — i.e. relative to the revenue LEVEL. The adapter compared the declared signed deviation against the recomputed deviation `a−e`, and `revenue_rel = 0.005·|e|` read `e` = the *deviation* (compare() only ever received the two deviation operands). The band collapsed to ~level/deviation (typically 20-100×) too tight. The module contradicted itself — the `ambiguous_referent` escape already used the level (`0.005·|a|`).

**Failure:** revenueActual 35.4B / estimate 35.0B → deviation 0.4B; a reporter declaring 0.42B (within two-sig-fig rounding of a 35B print) got band 0.005·0.4B = 2M → `|0.02B| ≫ 2M` → VERIFIED_WRONG. On a gate-bearing STRICT slot that Doug's S5 recaps feed, these false wrongs inflate `derivationErrorRate` past the 5% threshold → spurious gate failure. The prior test only checked exact-match, so the bug was untested.

**Fix:** thread an explicit `relBase` (the level) through `compare()`; revenue passes `relBase: a`; every other tolerance defaults to `e` unchanged. New test pins the level-relative band (0.42B deviation within 0.5%·35.4B = 0.177B → CORRECT; 0.7B → still WRONG), proven red under the reverted code.

### 2. MEDIUM — consensusJoinDate(null) returned '1970-01-01'
`api/_utils/wireEditorialAdapters.js` · found by state-concurrency.

`new Date(null)` is epoch 0 (1970-01-01), not an Invalid Date, so a missing `publishedAt` bypassed the `Number.isNaN` guard and returned `'1970-01-01'` — defeating the null-publishedAt handling and persisting a bogus bucket date as audit provenance. **Fix:** explicit nullish guard first (matching the export-script sibling, which already had it). Tests for null + undefined added.

### 3. LOW — dishonest return on a lost concurrent race
`api/_utils/wireEditorialRun.js` · found by state-concurrency.

`executeEditorialRun` returned `status:'complete'` even when a concurrent tick had already finalized the run (its `completeEditorialRun` returned `immutable_run`). No data corruption — the immutability guard holds and canonical is correct — but the return lied and a duplicate judge pass was billed. **Fix:** return `superseded_by_concurrent_run` on a lost race. The duplicate judge pass is an **accepted residual**: the pending_judge-through-execution design is exactly what makes budget-exhaustion RESUME work (P2-9); a claim/lease would eliminate the duplicate but strand a crashed run un-resumable. Recorded, not "fixed," because the tradeoff favors resume.

---

## CONFIRMED-THEN-REFUTED (2) — dispositions

### A. print_vs_expected deviation-relative band for large counts — **NEEDS FOUNDER RULING**
`api/_utils/wireEditorialAdapters.js` · completeness-holes finder; refuted by verify; **I concur it is not a code-vs-spec bug, but flag it for your ruling.**

The mechanical observation is correct: `print_native = bandFor(d,e,0.05,0.005)` uses `0.005·|deviation|` for `|declared| ≥ 10`, same shape as the revenue bug. **Why it is NOT the same fix:** §6's revenue row literally names the level ("of billions"); §6's print row says only "±0.5% relative" with a "prints declare at ≤1 dp; same half-step logic" rationale and names no level. The dominant macro case (CPI/PPI/GDP/rates — single-digit, `|declared| < 10`) uses the absolute ±0.05 band, no relative issue. Only large-count prints (nonfarm payrolls, jobless claims) hit the relative branch, where relative-to-deviation is arguably too tight (0.5%·17K deviation = 85, vs ~1K rounding uncertainty in the underlying counts).

**Disposition:** This is a §6 FINAL-LOCK **tolerance interpretation**, not a code defect — the code matches the literal spec text. Changing it (to level-relative, or a native-abs band for counts) requires a founder ruling AND a `WIRE_EDITORIAL_ADAPTER_VERSION` bump (F-M4, which resets the two-period window). **Does not block the dark merge** — flag-off, and it only bites when a large-count print recap is editorially sampled after `EDITORIAL_REVIEW_ENABLED` flips. Recorded in the separate-tasking register.

### B. Incomplete-judge run canonicalizes the week with no retry — **working as designed**
`api/_utils/wireEditorialRun.js` · state-concurrency finder; refuted by verify; I concur.

An incomplete judge (truncation / bad chunk, non-throw) yields a `status:'complete'`, `gateEligible:false` canonical run — no retry for that week. This is consistent with the gate machinery: any non-passing week (floor failure, epoch-mixed, incomplete judge) simply **extends the two-period window** (addendum §5 reachability / §7.3), it is not fatal. A thrown judge error still terminates `failed` (retryable, new runId); only a *structurally complete but incomplete-coverage* judge canonicalizes as ineligible. Acceptable; noted for your awareness.

---

## Register additions (report-don't-fix)

1. **§6 print_vs_expected relative base for large-count prints** — founder ruling + `adapterVersion` bump if changed (finding A above). *Medium — only bites post-editorial-flip on payrolls/claims recaps.*
2. **Editorial concurrent double-judge-pass** — the accepted resume-vs-cost residual (finding 3); a claim/lease is the only elimination and it costs the resume property. *Low.*
3. **api/health.js economicCalendar probe** (from N4) — retarget the connectivity probe to a live server-written collection in an observability pass. *Low.*

## Confidence & coverage

Every fix has a regression test proven red under the pre-fix code (A6 discipline, scratchpad-restore). The review's belt-not-sole-line posture held: these three are what the 6,600-test suite MISSED, on top of the per-commit fault-injection already done. All five Wire flags remain FALSE — the dark-merge guarantee is intact; a residual miss is bounded by the flip sequence's own gates.

*20260730_WIRE_P3_CODE_REVIEW.md — July 30, 2026*
