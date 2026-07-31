# Doug Tracked-Intersection Fix — Build Report

**Date:** 2026-07-31 · **Branch:** `claude/doug-earnings-tracked-intersection` (rebased onto `origin/main` @ `5715dcff`, post-D-3) · **Gates:** R9 S5 liveness (co-critical-path with D-3, now merged).

## Root cause (capture-CONFIRMED)

Doug's morning fire logged `outcome=empty_window fetched=3531 tracked=0`. The intersection at `generate-recap.js` read the reported EPS/estimate under the field names **`actual_eps` / `eps_estimate`**, but the EODHD `/calendar/earnings` schema names them **`actual` / `estimate`**. The founder's capture (2026-07-31, the exact failing URL) is definitive:

- 9-key schema — `actual, before_after_market, code, currency, date, difference, estimate, percent, report_date` — with **no `actual_eps`, no `eps_estimate`, no `name`**.
- Population across 3,531 rows: `actual` 462 non-null / `actual_eps` **0**; `estimate` 2,341 / `eps_estimate` **0**.
- Two-way intersection test: survive-current (`actual_eps`) = **0**; survive-proposed (`actual`) = **2** (AAPL, AMZN — both AMC, both real actuals).
- Symbol side vindicated: `code` + `.US` strip correctly found the 2 tracked reporters; not the zero-gate.

**A pre-existing defect** (in the original `generate-recap.js`, preserved verbatim by the R-B2 rewrite) that the morning-window fix merely **unmasked** by making the filter reachable with live post-close data.

## The fix (minimal)

`api/fantasytimes/generate-recap.js` — the tracked filter + map (only):
- reported EPS read is now `e.actual ?? e.actual_eps` (filter clause + `epsActual`); estimate is `e.estimate ?? e.eps_estimate`. `??` (not `||`) preserves a legitimate `0.00` EPS. The `?? actual_eps` fallback is defensive, matching the existing `ingest-earnings.js:127` house pattern — but the capture proves `actual` is the live field.
- `companyName: e.name || symbol` (was `e.name || ''`) — `/calendar/earnings` carries no `name`, so this stops the prompt rendering an empty `Company:` (secondary defect the same capture surfaced).
- comment at `:147` corrected (`actual_eps` → `actual EPS`).

Nothing else in the handler changed — the downstream outcome/surprise/plausibility/dedup/publish logic is untouched; it simply now receives real operands.

## A6 red/green (`generate-recap.trackedIntersection.test.js`, fixture `__fixtures__/earningsCalendarCapture.js`)

Fixture rows are **verbatim from the capture**. 6 tests:
- **RED** — the captured rows carry the 9-key schema (no `actual_eps`/`name`); the OLD `actual_eps` predicate keeps **0** of them (reproducing the production `tracked=0`); the NEW `actual`-based predicate keeps **2** (the fix).
- **GREEN** — the handler over the captured window (morning fire, Fri 2026-07-31 → prior session Thu 2026-07-30) writes an AAPL recap: `outcome=wrote fetched=5 tracked=2`, `epsActual 1.57` (from `actual`), `epsEstimate 1.88` (from `estimate`), outcome `miss`, `Company: AAPL` fallback; the 3 non-tracked fillers (SGE.F, CAP.PA, CAPMF.US) are excluded by the symbol clause.
- an unreleased tracked row (`actual: null`) is held by the data gate (`empty_window`, zero model calls, no error); referent dedup still holds post-fix (AAPL covered → AMZN written).

## Version / lock (mandatory)

`generate-recap.js` is a `GENERATION_SURFACE` member, so the edit forces `WIRE_GENERATION_VERSION` **12 → 13** + baseline regen (both confirmed: lock RED without the bump, GREEN after). **gateEpoch cost:** this is a generation-surface change, so it resets the two-period gate window — but it is precisely what makes S5 able to write at all, so the reset is the price of admission, exactly the R-B7 pre-flip batching law. Must land before `WIRE_WRITES_ENABLED` flips, alongside the recap arc + D-3.

## Scope / register

- **Fence:** no fenced file touched (BUILD_RULES §1). **Review threshold:** ~5 files / well under 1500 lines — under the §2 `/code-review` bar; careful self-review done.
- **Register (separate tasking, per §3):** the same phantom field names recur in sibling consumers — `submit-earnings-batch.js:129` (`eps_estimate`), `stocks/earnings-calendar.js:88` (`eps_estimate`/`market_cap`/`name`), `test-ingestion.js:39-40`, `ingest-earnings.js:127-128` (already hedged), `fantasyTimesConsensus.js:58` (`report_time`), plus `market_cap`/`name` phantoms in `fetchEarningsCalendarEODHD.js`. Audit them against the capture in a follow-up; out of scope for this minimal fix. (The capture artifact + the `capture-earnings-calendar-eodhd.js` script are the tools for that pass.)

## Verification

- New A6: 6/6 green. Generation-surface lock: green at v13.
- Full suite: **recorded in the PR** (run at build time; any failure fixed before push).
- Crons don't run on preview (§6): verification = the A6 above; the first production morning fire is the R9 S5-liveness observation. **Pushed ≠ deployed; the founder merges (§2).**
