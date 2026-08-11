# Doug earnings-recap surprise split — FIX + derivation record

**Date:** 2026-08-11
**Branch:** `claude/doug-recap-surprise-split` (cut fresh from `main` @ `d1dff398`)
**Diagnosis of record:** `20260810_DOUG_RECAP_SURPRISE_AND_INDEX_FINDINGS.md` Part 4 (founder-supplied; not in-repo — the derivation below re-verifies every anchor against live code this session).
**Verdict:** ✅ FIXED — the printed EPS surprise and beat/miss outcome now derive from the SAME calendar operands the recap prints, matching the STRICT editorial adapter. 9/9 new tests green; each A6 row proven red under the pre-fix defect (mutation-checked).

---

## Executive summary

| | |
|---|---|
| Defect | `dataSnapshot.surprise` / `outcome` came from EODHD **/fundamentals** (`getEarningsResult` with no date → most-recent row), while `epsActual`/`epsEstimate` came from **/calendar/earnings** for the report date. Two feeds, no date match. |
| Symptom | AMD recap printed **1.44 vs 1.35** (a +6.7% beat) next to a **−80%** surprise; `outcome` inherited the foreign feed's sign → a story could read *miss* while printing a beat. |
| Why urgent | `earnings_recap` is S5, and its surprise is a **STRICT** verification slot. The editorial adapter recomputes surprise from the stored operands, so every feed split scored **VERIFIED_WRONG** — failing gate periods on a plumbing bug, not a model defect. |
| Fix | (1) pass `reportDate` to the 7-day matcher; (2) derive surprise + outcome from the printed calendar `epsActual`/`epsEstimate`, matching the adapter's recomputation (§9). |

---

## Derivation (re-VERIFIED against live code, 2026-08-11)

1. **Two feeds.** `earning.epsActual`/`epsEstimate` are the **/calendar/earnings** operands (`generate-recap.js:246-247`, `e.actual ?? e.actual_eps`), printed at `:327-328` and stored at `:416-417`.
2. **The split source.** `getEarningsResult(earning.symbol)` was called with **no `targetDate`** (`generate-recap.js:273`), so the helper returned `entries[0]` — the most-recent history row, not necessarily the recapped quarter (`getEarningsResult.js:296`, and the 7-day matcher it *skips* at `:298-305`).
3. **The split print.** `outcome` preferred `earningsDetail?.outcome` and `surprise` preferred `earningsDetail?.surprisePercent` — the **/fundamentals** feed — over the calendar operands (`generate-recap.js:308-319`, pre-fix). So the printed/stored `surprise` was foreign to the printed `epsActual`/`epsEstimate`.
4. **The STRICT recompute.** The editorial adapter recomputes the surprise from the **stored operands**: `(epsActual − epsEstimate) / |epsEstimate| × 100` (`wireEditorialAdapters.js:338-340`, `eps_surprise_pct`, tolerance `0.5`), degrading to NOT_VERIFIABLE on a non-number operand (`:326`) or `estimate === 0` (`:336`). A split therefore adjudicated VERIFIED_WRONG.

---

## The fix (`api/fantasytimes/generate-recap.js`)

- **Lever 1 — date the fundamentals lookup** (`:273`): `getEarningsResult(earning.symbol, earning.reportDate)`. The 7-day matcher now returns the recapped quarter; `earningsDetail` is used only for supplementary context (priceMove / magnitude / revenue), never the printed surprise.
- **Lever 2 — derive from the printed operands** (`:308-315` → one call): `const { surprise, outcome } = deriveRecapSurprise(earning.epsActual, earning.epsEstimate)`. The new pure helper (`:58-85`) reproduces the adapter's formula **byte-for-byte** and its degrade boundaries, and `outcome` follows the computed surprise (`beat`/`miss`/`meet`), never a foreign sign. `|e| > 0 ⇒ sign(surprise%) = sign(a − e)`, so outcome and surprise cannot disagree by construction (§9).
- **Degrade** — a null/undefined/zero estimate yields `surprise = 'N/A'`, `outcome = 'unconfirmed'` (NOT_VERIFIABLE, never a fabricated beat, never a throw). The pre-fix `epsEstimate || 0` fabricated a `beat` from a null estimate; that is removed. Nothing downstream switches on the recap `outcome` enum (verified: `getDefaultVisual` passes it through to the `eps_gauge` config; `appendEarningsResult` stores it untyped).

## Generation surface

`generate-recap.js` is a `GENERATION_SURFACE` manifest member and the fix changes the reporter userMessage bytes (the Surprise/Outcome lines), so **`WIRE_GENERATION_VERSION` 16 → 17** (`wireContracts.js:119`, with a v17 history entry) and the committed baseline was regenerated (`wireGenerationBaseline.json`, via `WIRE_GENERATION_BASELINE_REGEN=1`). Epoch-resetting after the gate window opens; free now.

---

## A6 acceptance matrix (`generate-recap.recapSurprise.test.js`, 9/9 green)

Each handler row is **RED under the pre-fix defect and GREEN under the fix** — proven by an in-place mutation (revert the two levers, keep the helper): rows 1–4 fail, the pure-helper rows stay green; restore verified by sha.

| Row | Fixture | Asserts | Red pre-fix because |
|---|---|---|---|
| 1 — AMD | calendar 1.44/1.35; /fundamentals says −80% / miss | surprise `+6.7%`, outcome `beat`, prompt has no `-80.0%`, `getEarningsResult('AMD','2026-07-30')` | pre-fix printed `-80.0%` / miss |
| 2 — genuine miss | calendar 1.20/1.35; feed unresolved (null) | surprise `-11.1%`, outcome `miss` | pre-fix surprise was `N/A` |
| 3 — null estimate | calendar 1.44 / undefined estimate | status 200, outcome `unconfirmed`, surprise `N/A` | pre-fix fabricated `beat` |
| 4 — feed disagreement | calendar 5.20/5.00; /fundamentals says −30% / miss | surprise `+4.0%`, outcome `beat` | pre-fix followed the foreign −30% / miss |

Plus five pure-`deriveRecapSurprise` guards: AMD arithmetic, negative surprise, exact-match `meet`, **negative-estimate sign** (`|e|` keeps a smaller loss a beat), and the null/undefined/zero/non-number degrade.

Full unit suite: **7450 passed** (one pre-existing flake, below).

---

## CI note — pre-existing flake, NOT this diff (Drift Ledger D-7)

`compositionProtectedStores.scan.test.js` (`#10`) flakes over its 5 s timeout: the repo-wide AST scan runs **~4.6–5.1 s** and **times out on clean `main` (`d1dff398`) itself** (measured this session). The scan's assertion passes; only the timeout trips. Test files are excluded from the scan, and this change adds no write-method surface — so it is not caused by the Doug diff. Registered as **D-7** with a one-line-timeout fix seam for separate tasking.

## Files changed (5)

- `api/fantasytimes/generate-recap.js` — the two levers + `deriveRecapSurprise` helper.
- `api/_utils/wireContracts.js` — `WIRE_GENERATION_VERSION` 16 → 17 (+ v17 note).
- `api/_utils/wireGenerationBaseline.json` — regenerated baseline (machine-generated).
- `api/fantasytimes/generate-recap.recapSurprise.test.js` — A6 matrix + helper guards (new).
- `docs/DRIFT_LEDGER.md` — D-7 (the pre-existing scan flake).
