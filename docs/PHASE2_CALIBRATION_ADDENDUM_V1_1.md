# PHASE 2 CALIBRATION ADDENDUM — V1.1
## Coverage & shape statistics · recorded thresholds, floor, and tolerances (D-P2-16)

**Date:** July 29, 2026 (build session) · **Branch:** `claude/fantasytimes-phase-2-v1-2-u4rss9` @ `wireReader` commit
**Governing:** Spec V1.3 §4 P2 + D-P2-8/D-P2-16 · §7 calibration firewall (F-M11) · V1.4 R3-B4 / V1.5 R4-M1 binding rule
**Status:** **CONFIRMED — FINAL LOCK** (founder, July 29, 2026, per D-P2-11/D-P2-16). V1.1 = the confirmed V1 body, verbatim, plus the §9 ratification record. Committed to docs/ as part of the lock.

---

## 0. Firewall compliance statement (§7, F-M11)

This addendum consumes **coverage and shape statistics only**. Every number below derives from: executed contract exports at HEAD, persisted-field shapes read from source at HEAD, cron schedules, decimal-rounding granularities, and structural properties of instruments. **No error rate, accuracy figure, or correctness statistic was computed, observed, or consulted** — and none *could* be: `WIRE_WRITES_ENABLED` has been false since the dark merge, so zero Wire entries exist in production. There was nothing to quarantine; had any error-like observation occurred it would be quarantined from the numbers in §4–§6 per the firewall. Thresholds and tolerances below are recorded **with written rationale before the first flag-on review executes** (P10).

## 1. Inputs of record (all VERIFIED at HEAD this session)

**Slot enumeration — executed, not transcribed:** 12 (reporter × eventType) rows → **48 figure slots**, **16 magnitude slots** (`figureBasesFor` = row bases ∪ 3 shared bases; magnitude accepts row bases only). Reproduces discovery's denominator exactly.

**Admitted operand sources (D-P2-8):** the sampled story's `dataSnapshot` + the **generating-day** `fantasyTimesConsensus/{date}` bucket. No other source is admitted; cross-story joins (e.g. Kim reading Kai's same-day index quotes) are **not** admitted.

**Persisted shapes at HEAD:**

| Shape | Where written | Server-sourced operands at rest | Model-echo fields |
|---|---|---|---|
| S1 `kai_pulse` | `generate-pulse.js:397-406` | spy/qqq/dia/iwm `{price, change, changePercent}` (`buildIndexSnap`, `:366-369`), avgIndexChange | `topMovers` |
| S2 `alex_mover` | `generate-mover.js:309-315` | `price, change, percentChange, atrMultiple, direction` | — |
| S3 `neta_econ_print` | `generate-econ.js:334-343` | `actual, estimate, previous` (Sonar-emitted strings, server-persisted), spy/qqq `{price, changePercent}` | — |
| S4 `neta_econ_preview` | `generate-econ.js:553-557` | `totalEvents, highImpactCount` (counts only) | `weekHighlight` |
| S5 `doug_earnings_recap` | `generate-recap.js:299-307` | `epsActual, epsEstimate` (EODHD), `priceMove` (earnings-**day** move), `surprise, outcome` | — |
| S6 `doug_earnings_preview` | `poll-batch.js:141-146` | `symbol, reportDate` (server-parsed from custom_id) | `epsEstimate, revenueEstimate` |
| S7 `kim_column` | `generate-column.js:376-384` | `sectorPerformance` `{symbol, price, changePercent}` — **5 of 11 ETFs** | `topSectors` |

**Consensus bucket fields at HEAD** (write path protected by the merged Step 0 fix + its regression lock):
- `earnings.results[ticker]`: `result, epsActual, epsEstimate, revenueActual, revenueEstimate` (`generate-recap.js:356-362`; revenue fields nullable)
- `economics[]`: `event, actual, expected, impact, time` (`generate-econ.js:394-400`)
- `catalysts[ticker]`: `direction, percentChange, atrMultiple, catalyst, source, confidence` (`generate-mover.js:366-372`; **`scan-movers.js:138` persists `percentChange` as `Math.abs()`** with direction carried separately — a sign quirk the adapter rule in §6 absorbs)

## 2. The 48-slot coverage map

Classes: **STRICT** (recomputable from admitted server-sourced operands; defined null/parse fallbacks) · **PROXY** (recomputable with a documented caveat) · **CIRCULAR** (only the model's own restatement exists — spec-named UNVERIFIABLE, P2-39) · **DEAD-unbindable** (ticker-scoped basis on a row with no bindable entity, per the R4-M1 rule) · **UNAVAILABLE** (no operand at rest).

| Row | price_vs_level | volume_vs_avg | range_vs_atr | index/print/eps/etc. (own) | gap_vs_pc | price_vs_pc | 
|---|---|---|---|---|---|---|
| kai technical_break | UNAVAILABLE (no levels at rest) | UNAVAILABLE | — | — | UNAVAILABLE | PROXY-c¹ |
| kai volume_surge | — | UNAVAILABLE (own) | — | — | UNAVAILABLE | PROXY-c¹ |
| kai volatility_event | — | UNAVAILABLE | UNAVAILABLE² | — | UNAVAILABLE | PROXY-c¹ |
| kai index_move | — | UNAVAILABLE | — | **PROXY³** (index_vs_pc) | UNAVAILABLE | PROXY³ |
| alex market_mover | — | UNAVAILABLE | — | **STRICT** (price_vs_pc own) | UNAVAILABLE | (=own) |
| alex gap_event | — | UNAVAILABLE | — | UNAVAILABLE (gap own — no open at rest) | (=own) | **STRICT** |
| neta econ_print | — | DEAD-unbindable | — | **STRICT-p⁴** (print_vs_expected) | DEAD-unbindable | DEAD-unbindable |
| neta econ_preview | — | DEAD-unbindable | — | CIRCULAR ×2 (consensus_estimate, prior_print) | DEAD-unbindable | DEAD-unbindable |
| doug earnings_recap | — | UNAVAILABLE | — | **STRICT** (eps_vs_consensus) · **STRICT-n⁵** (revenue_vs_consensus) | UNAVAILABLE | PROXY-a⁶ |
| doug earnings_preview | — | UNAVAILABLE | — | CIRCULAR ×2 | UNAVAILABLE | UNAVAILABLE |
| kim sector_rotation | — | UNAVAILABLE | — | UNAVAILABLE (sector_vs_spy — SPY not at rest at this seam; cross-story not admitted) | UNAVAILABLE | PROXY-e⁷ |
| kim leadership_shift | — | UNAVAILABLE | — | UNAVAILABLE (rs_vs_peers — overwritten singleton not admitted) | UNAVAILABLE | PROXY-e⁷ |

Caveats: ¹ via generating-day `catalysts[ticker]` — presence conditional (only tickers that fired a catalyst), abs-sign rule §6. ² ATR reaches Alex's seam, not Kai's — a contract-allocation fact, recorded; no operand at Kai's seam. ³ ETF↔index proxy, `pct` unit only; `pts`/`usd` → NOT_VERIFIABLE(`unit_unsupported`); **VIX has no leg** — an `index_move` declaring VIX is NOT_VERIFIABLE(`no_proxy_instrument`). ⁴ operands are Sonar-emitted strings: strict numeric parse first, failure → NOT_VERIFIABLE(`unparseable_operand`). ⁵ revenue fields nullable: null → NOT_VERIFIABLE(`missing_operand`). ⁶ `priceMove` is the earnings-**day** move while the prompt also showed a current-session change — ambiguous referent, PROXY with the declared-referent rule: compare against `priceMove` only, and the memo's audit row records the ambiguity code. ⁷ 5-of-11 ETFs stored; entity must be one of the five, else NOT_VERIFIABLE(`missing_operand`); `leadership_shift` entities are typically stocks → mostly unverifiable in practice, structurally.

**Totals (figure slots):** STRICT **5**/48 · PROXY **8**/48 · CIRCULAR **4**/48 · DEAD-unbindable **6**/48 · UNAVAILABLE **25**/48.
**Magnitude slots:** STRICT **4**/16 (market_mover price_vs_pc · econ_print print_vs_expected · eps · revenue) · PROXY **2**/16 (index_vs_pc · doug price_vs_pc) · CIRCULAR **4**/16 · UNAVAILABLE **6**/16.
**Per-reporter (STRICT / produced figure slots):** kai 0/15 · alex 2/6 · neta 1/9 · doug 2/10 · kim 0/8. With PROXY: kai 4/15 · alex 2/6 · neta 1/9 · doug 3/10 · kim 2/8 → **13/48 addressable**.
**keyLevel:** 0 of 9 level types at rest at any seam → keyLevel adapters are structurally out of Phase 2 scope (consistent with D-P2-14's label-only N5).

## 3. Shape → adapter mapping (F-M5)

| Adapter | Keyed on shape | Bases it recomputes | Sources |
|---|---|---|---|
| `quoteDelta` | S2 | price_vs_prior_close (strict) | dataSnapshot |
| `indexProxy` | S1 | index_vs_prior_close, price_vs_prior_close (proxy³) | dataSnapshot |
| `econPrint` | S3 | print_vs_expected (strict-parse⁴) | dataSnapshot + `economics[]` |
| `earnings` | S5 | eps_vs_consensus (strict), revenue_vs_consensus (strict-null⁵), price_vs_prior_close (proxy-a⁶) | dataSnapshot + `earnings.results` |
| `sectorQuote` | S7 | price_vs_prior_close (proxy-e⁷) | dataSnapshot |
| `catalystQuote` | S1-adjacent (kai single-ticker rows) | price_vs_prior_close (proxy-c¹) | `catalysts[ticker]` |
| — (classifier only) | S4, S6 | none — **UNVERIFIABLE(`circular`)** by spec text, never adapted | — |
| — | any unrecognized shape | **NOT_VERIFIABLE(`unknown_shape`)**, counted, never a throw | — |

**Binding precondition (all adapters, R4-M1):** entity set = `tickers[] ∪ offUniverseTickers[] ∪ subjectRef`, normalized + deduped, typed-only. A figure binds iff exactly one unique entity AND `primaryTicker` equals it AND the basis is statically `ticker_scoped`; else NOT_VERIFIABLE(`unbindable`). The static `ticker_scoped`/`market_scoped` classification lands in `wireContracts.js` at build (P3) — `index_vs_prior_close`, `print_vs_expected`, `consensus_estimate`, `prior_print`, `sector_vs_spy` classify `market_scoped`/subject-scoped; the rest `ticker_scoped`.

**Consensus join rule:** the bucket is keyed by the **writers'** expression — UTC date (`toISOString().split('T')[0]`). Adapters derive the join key from the sampled story's `publishedAt` with the **same expression** (display-agreement analog: same source, same derivation), never from the Wire `marketDate` (ET, snap-forward — a different calendar on exactly the after-hours windows Doug and Sunday Neta occupy).

## 4. Derivation-error threshold — RECORDED: **5% over VERIFIED stories per period**

**Rationale (structural, fixed pre-results):** inherited unchanged from the Phase 1 spec's §6.1 gate criterion ("editorial derivation-error <5% stratified"), which was fixed at V1.5's lock **before any Wire entry existed anywhere**. Recording the same number here means the weekly editorial verdict and the Phase 3 gate read one threshold — they cannot disagree (display-agreement analog applied to gates). VERIFIED = adapter returned VERIFIED_CORRECT or VERIFIED_WRONG (D-P2-6 denominator: NOT_VERIFIABLE in any reason class is excluded from the denominator and reported as the unverifiable rate).

## 5. Verifiable-denominator floor — RECORDED: **≥ 5 VERIFIED stories AND ≥ 2 contributing shapes**

A period with fewer than 5 VERIFIED stories, or with all VERIFIED stories from a single adapter shape, is `gateEligible: false` (floor failure), reported with per-stratum counts.

**Rationale (structural):**
- *Why a floor at all:* at 5% threshold, a pass at tiny n is vacuous — 0 errors over 2 stories "passes" while evidencing almost nothing. Five independent confirmations is the minimum at which a zero-error period is evidence rather than absence of data. One VERIFIED_WRONG at n=5 is 20% → correctly fails; the floor cannot mask an error, only starve a vacuous pass.
- *Why two shapes:* a single-shape denominator makes the period's rate a statement about one adapter presented as the newsroom's (D-P2-8's structural-zero shapes make this a live risk). Two shapes is the minimum for the rate to be a property of the system.
- *Reachability (structural volumes only, from cron schedules and calendars — not observed rates):* Neta's recap cron fires half-hourly through the session and produces a story per econ release with an `actual`; a normal macro week carries several qualifying releases. Alex's seam is event-driven (54 tickers, 3% threshold). Doug's recaps track the earnings calendar (zero in blackout is legitimate). An ordinary week clears the floor via S3+S2; a quiet or holiday week may legitimately fail it — **that is correct behavior**: no verdict is better than a vacuous one, and the two-passing-periods gate simply extends by a week.

## 6. Initial adapter tolerances — RECORDED (F-M4: fixed at lock; any change bumps `adapterVersion` and resets the two-period window)

All comparisons run after rounding both sides to 4 decimal places (IEEE noise kill). Unit dispatch is a closed table; an unsupported (basis × unit) combination → NOT_VERIFIABLE(`unit_unsupported`) — never a guess.

| Basis class | Unit | Tolerance | Written rationale (all structural) |
|---|---|---|---|
| price_vs_prior_close, index_vs_prior_close (strict paths) | `pct` | **±0.05 pp** for \|declared\| < 10, else **±0.5% relative** | Declared values render at ≤2 dp (renderer trims; typical 1 dp). 0.05 = half-step of 1-dp rounding — pure rounding slack, no empirical content |
| index_vs_prior_close / price_vs_pc via ETF proxy (S1) | `pct` | strict tolerance **+0.10 pp** (total ±0.15 pp) | Structural tracking deviation of the proxy instrument pair (fee drag, NAV timing) — a property of ETFs, not of our data. `pts`/`usd`: excluded (no index point values at rest) |
| eps_vs_consensus | `usd` | **±$0.005** | EPS reported to cents; half-cent rounding slack |
| eps_vs_consensus | `pct` (surprise) | **±0.5 pp** | Surprise recomputed from the same cent-rounded operands; 0.5 pp bounds the propagated rounding at small denominators |
| revenue_vs_consensus | `usd` | **±0.5% relative** | Consensus stores raw units; declared revenue is conventionally 2–3 sig figs (B/M rounding); 0.5% covers two-sig-fig rounding of billions |
| print_vs_expected | native | **±0.05** for \|value\| < 10, else **±0.5% relative** — after strict parse (optional %, K/M/B suffix, comma strip); parse failure → NOT_VERIFIABLE(`unparseable_operand`) | Prints (rates, pp, counts) declare at ≤1 dp; same half-step logic. The parse rule is the P9 boundary: a value that won't parse deterministically is never eyeballed |
| price_vs_prior_close via `catalysts[ticker]` | `pct` | **±0.10 pp**, compared as \|declared\| vs \|operand\| with `direction` matched separately | `scan-movers.js:138` persists `Math.abs(percentChange)` while `generate-mover.js:368` persists signed — the abs/sign split is absorbed by comparing magnitude and direction as separate dimensions (both persisted) |
| price_vs_prior_close on S5 (`priceMove`) | `pct` | **±0.10 pp** vs `priceMove` only | Ambiguous-referent caveat⁶: the adapter compares against the single persisted candidate and stamps the ambiguity code on the audit row — never adjudicates which number the model "meant" (P9) |

## 7. Recorded consequences the founder is accepting at lock

1. **The Phase 2 gate measures 5 strict + 8 proxy slots.** Kai and Kim contribute no strict slot; both preview shapes are named CIRCULAR; 25 slots have no operand at rest. Widening coverage (persisting `open`/`volume`, a SPY leg at Kim's seam, snapshot enrichment) remains the separate arc V1.2 §8 already names — nothing here forecloses it.
2. **VIX `index_move` claims are unverifiable** (no proxy instrument at rest).
3. **A quiet week can legitimately fail the floor** and extend the two-period window — by design.
4. **TICKER_TO_SECTOR value lock** (P1 closeout) is bound to `WIRE_GENERATION_VERSION` beyond the ruling's consensus-block scope — **ratification requested** (rationale in the lock commit: the validator constant is semantically live on every stamped entry and must not bump for a lock-mechanism change).

## 8. P2 build record (context for this addendum)

- **N1.0 delivered:** `api/_utils/wireReader.js` — fetch/resolve split for the one-fetch-per-tick budget; quarantine + dangling-id belts both A6-verified red-under-fault; P2-48 auto-covers it; OUT of the generation manifest (consumes generation, doesn't shape it).
- **P1 closeout delivered:** rankingConfig value lock per ruling — `ALL_TICKERS` (the enumerated consensus-block set: `fantasyTimesConsensus.js:9`, used at `:247` catalyst ranking and `:441` attribution) + `TICKER_TO_SECTOR` (§7.4 above); A6 both directions (simulated ticker change → red naming the value key + regen refused; unrelated rankingConfig edit → green); `WIRE_GENERATION_VERSION` 2→3.
- Full repo suite at delivery: **6043 passed, 0 failed, 53 skipped** (the P1 checkpoint's "6039" predates the value-lock suite's 4 tests).

---

**STOP.** Per D-P2-11/D-P2-16, your confirmation of this addendum — thresholds (§4), floor (§5), tolerances (§6), and the recorded consequences (§7) — is **FINAL LOCK**. On confirmation, this addendum is committed to `docs/` beside the spec set and the P3 build begins against the 49-row matrix. No P3 work has been started.

---

## 9. Ratification record (FINAL LOCK, July 29, 2026)

Founder confirmation, verbatim in effect: §4 threshold, §5 floor, §6 tolerances, and consequences §7.1–7.3 **accepted as written**. §7.4 **RATIFIED with one recorded caveat**:

> The generation-version binding governs the lock mechanism, but a TICKER_TO_SECTOR content change is a validation-behavior change — when that lock fires, bump WIRE_VALIDATOR_VERSION alongside WIRE_GENERATION_VERSION so each stamp is truthful about its own axis.

**The caveat is enforced mechanically, not procedurally:** `assessTickerUniverseCaveat` (`api/_utils/wireGenerationSurface.js`) refuses any baseline regeneration that carries a TICKER_TO_SECTOR value change without a WIRE_VALIDATOR_VERSION bump, and the regen branch of the P2-15 lock runs it on every regeneration. Unit-covered in all four cases (changed+unbumped → refused citing the caveat; changed+bumped → allowed; unchanged → allowed; first generation → allowed). Landing this enforcement changed the manifest module itself → WIRE_GENERATION_VERSION 3 → 4 (mechanism-scope bump, recorded in wireContracts.js).

With this record, the D-P2-11/D-P2-16 lock conditions are complete: spec set V1.2–V1.5 + Addendum A committed (P0) · thresholds, floor, and tolerances recorded with rationale (§4–§6) · this confirmation. **Phase 2 is LOCKED; the P3 build proceeds against the 49-row matrix.**
