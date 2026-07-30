# RECAP RESTORATION — MINI-ARC SPEC V1.1

Date: July 30, 2026 · Supersedes V1 · Fable single pass folded (all findings accepted; changelog below). ChatGPT pass skipped per reviewer recommendation (invariant surface now covered). Next: CC discovery-lite (read-only, STOP) → founder reviews STOP items → build → PR → founder merges → deploy → R9 observation window.

V1.1 changelog: Press 1 → R2 tightened (captured fixture, VERIFIED assertion, type/null/scaled variants) + discovery names the parse path. Press 2 → new C8 (referent identity, pre-call dedup, referent-pinned date expression) + Wire-bucket clarification. Press 3 → R9 rewritten (dual-count log, fallback form, liveness-only observable). Constraint audit → C2 prior-session fixtures, log taxonomy. Timing → epoch-sequencing runbook line. STOP items → DRB-array cross-validation, worst-case budget number. Register → AMC prose-honesty prompt edit in scope; reaction-day field post-gate; N4/F1 disjointness asserted by name.

## 1. Why / timing law — unchanged from V1

S3 + S5 structurally silent; floor unpassable while indistinguishable from the accepted quiet week. Both files are generation surface → bump + epoch reset, free pre-runway only. New runbook law (epoch sequencing): all pre-flip generation-surface PRs — this arc AND the exemplar PR — merge before the R9 observation window opens; any later generation-surface merge restarts the window. Co-critical-path is now sequence-coupled, not merely parallel.

## 2. Fixes — F1/F2 as V1, plus:

* F1 log is two numbers: fetched-event count pre-filter AND Tier-1 count post-filter, every firing.
* F2 prose honesty (Rule-Honesty class): for AMC reporters the earnings-day `priceMove` is the pre-reaction session (EarningsGame reference: AMC reaction = close→next-close). The minimal prompt edit must prevent "moved X% on the news" phrasing over an earnings-day operand — describe it as the into-earnings session move. Reaction-day move as a new field → register, post-gate (new field = version bump + adapter change).
* Skip-log taxonomy (all skip paths, both fixes): `fetch_failed` / `empty_window` / `already_written` / `wrote` — distinguishable by grep. An EODHD outage must not reproduce the silent zero in a new costume.

## 3. Constraints — C1, C3–C7 as V1; C2 extended; C8 new

* C2 (extended): "prior session" = trading-day-minus-one via the existing walker/`marketSchedule.js` holiday calendar — not date-minus-one. Fixtures: 00:30 UTC boundary (V1) + Monday 07:00 ET → recaps Friday + day-after-holiday → recaps pre-holiday session. (Fault: date-minus-one substitution → weekend/holiday rows red.)
* C8 (new) — referent identity, checked before the model call: (a) Identity keys on the event referent — `(symbol, earningsReportDate)` for S5, `(canonical event, releaseDate)` for S3 — never the firing date. (b) Pre-call dedup: an existing non-superseded story with the same identity → skip (`already_written`) with zero model calls. This is what protects the editorial tenant from 5× generation and resolves morning-vs-midday overlap; window overlap becomes resilience, not a defect. (c) Consensus date expression pinned to the referent: the bucket write for a recapped event lands on the event's date, not the firing's — C7 froze shapes; C8 freezes the date value the locked join rule depends on. Clarification for the builder: the Wire receipt bucket remains firing-scoped by design (B5 immutable bucketing, locked Phase 1 semantics — do not re-key it); referent-level dedup therefore lives story-side pre-call, exactly here. (A6 rows: already-written fixture → second firing skips, model-call count 0; unknown-`beforeAfterMarket` fixture eligible in both windows → exactly one story.)

## 4. Discovery-lite — V1 items plus:

6. econPrint parse path at file:line — the basis-class per operand and whether the parse is type-gated (Press 1's exact hazard).
7. Capture one real EODHD calendar response (raw, provenance-commented) — it becomes R2's fixture source.
8. Jobless-claims Tier-1 status under the proposed mapping (if Tier-1, an empty S3 week is near-impossible and R9's strong form suffices with a ≤1-week bound).
9. DRB agency arrays: weigh as the released-Tier-1 set determinant (EODHD supplying operands only); at minimum cross-validate the importance→Tier-1 mapping against them — divergence indicts the mapping, not the arrays. Founder-visible at STOP.
10. Worst-case daily model-call delta (dedup-regression case, 5×/story) stated as a number at STOP; sweep floor untouched by construction.
11. N4/F1 disjointness asserted by named files (Neta reader cleanup vs writer fix), not assumed.

## 5. Acceptance — V1 rows amended:

* R2 (tightened): fixture built from the captured real EODHD response (provenance comment mandatory); asserts VERIFIED status, not "parses"; variants: number-typed operands · string-typed operands · `estimate: null` (consensus gap — must degrade to NOT_VERIFIABLE(`missing_operand`), never reject the event wholesale) · scaled representation (prompt-rendered "187K" vs stored 187000 → still VERIFIED via unit normalization).
* R9 (rewritten — liveness only, dual form): Strong: S3 and S5 each write ≥1 production prose story pre-flip. S3 fallback (quiet stretch): fetch succeeded + pre-filter count > 0 + Tier-1 = 0, founder cross-checks the public calendar — distinguishing "world was quiet" from "mapping is wrong." Runbook wording states plainly: R9 proves generation liveness only; VERIFIED-capability is proven solely by R2 offline (zero typed entries exist pre-flip by construction — the firewall record says so).
* C8's two rows and C2's two fixture rows join the matrix. R1/R3/R4 as V1, with R1/R3 skips asserting the §2 taxonomy codes.

## 6. Process — as V1, plus the epoch-sequencing line

Discovery STOP surfaces: EODHD mapping + DRB cross-check, the captured response, the parse-path citation, the budget number, the disjointness assertion. Merge order: mini-arc PR + exemplar PR both merged → then the R9 observation window opens → then the flip runway. Founder merges everything; pushed ≠ deployed.

*RECAP_RESTORATION_MINIARC_SPEC_V1_1.md — July 30, 2026*
