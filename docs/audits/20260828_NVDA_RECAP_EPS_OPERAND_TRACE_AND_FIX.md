# NVDA Earnings-Recap EPS Operand — Read-Only Trace

**Date:** 2026-08-28
**Branch:** `claude/nvda-eps-data-accuracy-j6bp11` (cut fresh from `main`)
**HEAD:** `186f72a5` (`Merge pull request #791 …`), working tree clean, 0 ahead / 0 behind `origin/main`
**Discipline:** BUILD_RULES §3. `git fetch origin` run at session start (recorded). **Strictly read-only** — no file edited, staged, or written in the repo tree. Every claim carries a `path:line` citation with a **VERIFIED** (read this session) / **ASSUMED** marker.
**Method:** Direct reads of the whole recap path + a 12-agent adversarial workflow (6 discovery lanes, each independently refuted). 4 lanes CONFIRMED, 2 PARTIAL — over-claims corrected below; **no central finding was refuted.**
**Status:** TRACE reported first (§§1–8), then FIX delivered on founder approval (§9); fiscal-date answer §10. Full suite 8200 green.

---

## Executive verdict

| Question | Answer |
|---|---|
| **Where did the operands come from?** | Both `epsActual` (0.99) and `epsEstimate` (2.09) are the **same EODHD `/calendar/earnings` row**, taken **verbatim** (`e.actual` / `e.estimate`). `0.99` is a bad **value inside that one row**; `2.09` is right. |
| **Was the row date-matched to the right quarter?** | **No quarter matching exists at all.** A row is taken purely on (tracked ticker) + (well-formed `report_date`) + (non-null actual). No fiscal field is even read — EODHD ships a `date` (period-end) column, and the code ignores it. |
| **Restated / split-adjusted / forward-quarter row selected?** | **Not a split** (0.99 / 2.22 ≈ 0.446 — no clean split ratio; nothing in the EPS path multiplies/divides/adjusts). **Forward-quarter excluded** (needs a non-null actual). Most likely a **preliminary/erroneous or stale-quarter `actual`** on the calendar feed. |
| **Why did every verification layer pass it?** | Because they all re-derive from the **same wrong operand.** `deriveRecapSurprise`, the editorial adapter, and the plausibility gate check *arithmetic/scale*, never *operand truth*. The story scores **VERIFIED_CORRECT.** |
| **Would a plausibility gate have caught it?** | A **±X% surprise hold** catches it only barely (52.6% ≈ the X=50 line) and mis-fires on real big surprises. A **cross-source disagreement hold** (calendar actual vs the fundamentals actual **already fetched and discarded** in the same call) is the better gate — it fires on *disagreement*, not on *magnitude*. **Recommended: cross-source primary; surprise-% as an optional loose backstop.** |
| **Blast radius** | **Editorial/news surface only.** Game resolution, odds, and beat-rate rankings are **insulated** (they read a different EODHD endpoint). Trading agents see only the **headline** (wrong beat/miss framing), not the number. |
| **Fix locus** | Entirely in **non-fenced** `api/fantasytimes/generate-recap.js`. **No calibration-fence contact.** |

The defect is exactly as you framed it: **upstream of every layer we built.** The operand is wrong before any verifier runs, and every verifier's job is to confirm the *story is self-consistent* — which it is.

---

## 1. Provenance — where the operands come from (Lane 1, CONFIRMED)

The **single** source of the printed `epsActual`/`epsEstimate` is the live EODHD `/calendar/earnings` fetch inside the recap handler:

- Fetch: `fetchEarningsWindow(fromET, todayET)` → `https://eodhd.com/api/calendar/earnings…from=&to=` → `data.earnings` — a direct HTTP call, **no cache/fixture in production** (`generate-recap.js:142-148`, invoked `:225`). **VERIFIED.**
- Read: `epsActual = e.actual ?? e.actual_eps`; `epsEstimate = e.estimate ?? e.eps_estimate` (`generate-recap.js:249`, `:265-266`). **VERIFIED.**
- The operative field is **`e.actual`**: the founder-run 2026-07-31 capture shows a 9-key schema — `actual, before_after_market, code, currency, date, difference, estimate, percent, report_date` — with `actual`/`estimate` populated and `actual_eps`/`eps_estimate` **0-populated across all 3,531 rows**, so `?? e.actual_eps` is a dead fallback (`api/_utils/__fixtures__/earningsCalendarCapture.js:6-10`). **VERIFIED.**
- The same two operands flow **verbatim** into: Doug's prompt (`EPS Actual: ${earning.epsActual}` / `EPS Estimate…`, `:438-441`), the story `dataSnapshot` (`:526-534`), and the consensus append (`:591-599`). **VERIFIED.**
- The printed **surprise/outcome are recomputed from those same operands** via `deriveRecapSurprise(earning.epsActual, earning.epsEstimate)` (`:430`), **not** from any fundamentals feed. **VERIFIED.**

> `0.99` itself is the one link that cannot be closed read-only — the live EODHD payload for NVDA's window isn't in the repo. The code path *forces* `e.actual` to be the source; the specific value is **ASSUMED** from your capture (`generate-recap.js:249,438`; ASSUMED).

**No other writer feeds these operands.** `generate-recap.js:511` is the sole production writer of a `type:'earnings_recap'` story (all other matches are tests). `submit-earnings-batch.js` and `poll-batch.js` write only `earnings_preview` (estimate-only, no actual). `ingest-earnings.js` / `test-ingestion.js` ingest qualitative claims. `api/stocks/earnings*.js` write no stories. **VERIFIED** (grep union: zero write-patterns; `vercel.json:104-139`).

`generate-recap` is a **live cron**: `0 13,20,21,22,23 * * 1-5` (`vercel.json:108-111`). **VERIFIED.**

---

## 2. Date-match & quarter selection (Lane 2, PARTIAL — one over-claim corrected)

**There is no fiscal-quarter validation on the calendar side, of any kind.** The filter/map reads only `code`, `name`, `report_date`, `actual`, `estimate`, `before_after_market` (`generate-recap.js:253-269`). A row is selected on:

1. `code` maps to a tracked ticker,
2. `report_date` is a well-formed `YYYY-MM-DD`,
3. `actual` is non-null.

The window is enforced **100% by EODHD's `from`/`to` params** — there is no client-side range re-check, and **EODHD's own `date` (fiscal period-end) column is never read.** A restated / split-mismatched / stale `actual` on the *correct* `report_date` is taken verbatim. That is precisely the shape of this defect. **VERIFIED.**

Two amplifiers worth flagging:

- **Surprise-first ranking evicts the correct row.** Candidates are ranked by `|surprise %|` (`recapNewsworthiness`, `:101-104`, sort `:310`). If two EODHD rows share `report_date`, the dedup key `SYM:reportDate` collides and the **more extreme wrong operand wins**: `0.99 → −52.6%` outranks a correct `2.22 → +6.2%` and is the one published. If the two rows carry *different* `report_date`s, both survive dedup and both can publish. **VERIFIED** (structural); whether EODHD actually emits duplicate rows is **ASSUMED / not determinable read-only.**
- **Fundamentals-side fallback** (`getEarningsResult`) can silently return the most-recent quarter (`entries[0]`) when its 7-day matcher misses (`getEarningsResult.js:296-334`). **Correction (adversarial):** this corrupts only the **supplementary** `priceMove` (printed `:443`, stored `:532`) and `magnitude` (**stored-only, visually inert** — the `eps_gauge` is built from `epsActual`/`epsEstimate`/`outcome`, not `magnitude`; `fantasyTimesVisuals.js:74-88`). It **cannot** corrupt the printed EPS/surprise/outcome. **VERIFIED.**

---

## 3. Split / restatement / feed-value mechanism (Lane 3, PARTIAL — citations corrected, conclusion intact)

- **No split adjustment anywhere on the EPS path.** No multiply/divide/adjust touches the EPS actual; the only split module (`mandateCorporateActions.js`) lives in the portfolio-mandate path and is imported by nothing on the earnings path. **VERIFIED** (full grep).
- **Ratio analysis rejects a split.** `0.99 / 2.22 = 0.446` — nearest standard fraction (½) is ~12% off; a 10:1 split gives ~0.22. A split needs a ~2.24× non-clean factor. **Split is a poor fit and unsupported by code.** **VERIFIED (arithmetic) / ASSUMED (truth 2.22).**
- **Most-likely mechanisms**, ranked, for "actual ≈ 44% of truth while the estimate is correct": (1) a **preliminary/erroneous** EODHD `actual` later corrected; (2) a **stale / wrong-quarter** `actual` left in an otherwise-updated row; (3) GAAP-vs-non-GAAP (class exists in the codebase but the gap is far too small to reach 0.99); (4) split / (5) currency — LOW/LOWEST. **ASSUMED** (analytical; the raw fire-time row is needed to distinguish (1) from (2)).
- **No settle / stabilization step.** The filter only requires a non-null actual; the first firing that sees a value publishes it (`generate-recap.js:253-255`). The known "actual availability timing" defect was the *opposite* failure (actual absent); the R-B2 morning-window fix added a window, **not** value stabilization. **VERIFIED.**

---

## 4. Why every verification layer passed it (Lane 4, CONFIRMED)

All three layers re-derive from the **same stored operand**, so a self-consistent wrong operand is indistinguishable from truth. With `(a,e) = (0.99, 2.09)`:

| Layer | What it computes | Result | Cite |
|---|---|---|---|
| `deriveRecapSurprise` | `((0.99−2.09)/|2.09|)×100 = −52.63%`, `outcome='miss'` | Internally consistent — validates the **formula**, not the operand | `generate-recap.js:58-85` |
| Editorial adapter `eps_vs_consensus` (pct) | Recomputes `−52.63%` from `ds.epsActual/ds.epsEstimate`; `|declared − recomputed| ≤ tol 0.5` | **VERIFIED_CORRECT** (no `status_inversion` — same sign) | `wireEditorialAdapters.js:335-343`, `compare` `:107-134`, tol `:74` |
| `assessEpsPlausibility` | `delta=1.10`; `threshold = max(absBand 20, 0.5·max=1.045) = 20`; `1.10 > 20 → false` | **No hold** | `econPrintVerifier.js:204-219`, `isImplausibleDelta:155-159`, `EPS_SURPRISE_BAND_ABS=20:152` |

**The gate's blind spot, stated exactly.** `isImplausibleDelta` holds only when `delta` exceeds the **larger** of a $20 absolute band and 50% of the larger operand. For any normal-scale EPS the **$20 arm always dominates** the ~$1 relative bound, so **the 50% relative arm never binds.** The gate therefore catches ~100× cents-for-dollars mis-scaling and essentially nothing else — a −52.6% miss on a ~$2 name (`delta $1.10`) is nowhere near it. The band was **deliberately loosened $5 → $20** to stop holding legitimate large-dollar surprises (`econPrintVerifier.js:146-152`, "review finding M2"), which is exactly what opened this hole. **VERIFIED.**

(The `eps_vs_consensus` **usd** branch is equally blind for the same reason — it recomputes `a−e` from the same operands; `wireEditorialAdapters.js:327-333`.)

---

## 5. Plausibility-gate design assessment (Lane 5, PARTIAL — assess-only, no code)

### Option A — "hold if `|surprise %| > X`"
- The gate **already has a relative arm** (50%); it's just neutered by `max(20, …)`. A dedicated surprise-% hold would restore it.
- Catches NVDA at **X=50** (52.6% > 50 — *thin* margin) and **X=40**. **VERIFIED (arithmetic).**
- **Fires on magnitude alone** — it cannot tell a bad operand from a genuine big surprise, so it carries real false-positive cost on small-EPS names and the GAAP-vs-operating M2 class the band was loosened to protect.
- **Important wiring caveat (adversarial correction):** there is **no review queue** today. The existing hold path *suppresses* via `continue` (`generate-recap.js:359-367`) — a held candidate is simply dropped for that firing. A surprise-% gate wired the same way would **drop** the most-newsworthy real beats, reproducing the editorial silence the Recap-Restoration arc removed. "Held for review" would require building the queue. **VERIFIED.**

### Option B — cross-source disagreement hold (recommended primary)
- **The data is already in hand and thrown away.** `getEarningsResult(symbol, reportDate)` returns a fundamentals `epsActual` (`getEarningsResult.js:416`) — plus `surprisePercent`, `epsSurprise`, `didBeat`, `didMiss` (`:418-421`) — and the recap **fetches it but reads only** `priceMove`/`magnitude`/`revenue` (`generate-recap.js:388,443,532-533,597-598`). A cross-check needs **no new fetch.** **VERIFIED.**
- It targets the actual defect (operand integrity) and fires only on **disagreement**, so its false-positive cost is far lower than a magnitude gate. In this case the fundamentals feed would resolve NVDA to ~2.22 (a beat) — the exact value the game already trusts (§6) — so calendar 0.99 vs fundamentals 2.22 is a stark, catchable disagreement.
- **Two confounds to design around** (do not ship a naive equality check):
  1. **Split-adjusted vs as-reported.** Calendar `actual` may be as-reported while fundamentals `Earnings.History` may be split-adjusted — a naive equality check would false-positive on **every** split stock. Use a **relative tolerance / ratio-aware** comparison, not equality. *(Repo asserts no adjustment policy either way — this confound is ASSUMED from the task, and a live two-feed capture on a recently-split name is what would settle the exact normalization.)*
  2. **Missing / pending / quarter-mismatch.** `getEarningsResult` returns `resolved:false` (no `epsActual`) when fundamentals hasn't posted (`getEarningsResult.js:275-293, 344-351`), and its 7-day matcher can fall back to `entries[0]`. The gate must **fail-OPEN** on an unresolved/quarter-ambiguous fundamentals row — never hold a real story because the *second* feed was silent.
- **Framing nit:** calendar and fundamentals are **two EODHD endpoints under one vendor**, not two independent vendors. They demonstrably diverge (the AMD feed-split bug documented at `generate-recap.js:425-429`), so the cross-check has real signal — but it is not a two-vendor guarantee.

### Recommendation
**Cross-source disagree-hold as the primary gate** (lowest false-positive cost, targets the operand directly, uses data already fetched), **optionally backed by a permissive surprise-% *review* trigger** (not an auto-drop) once a review queue exists. Surprise-% **alone** is not recommended as the sole gate. *Both* would have caught this case; only the cross-check catches the general "wrong-but-self-consistent operand" class without holding real news.

---

## 6. Blast radius (Lane 6, CONFIRMED)

- **Consensus write is inert.** `appendEarningsResult` persists `{result:'miss', epsActual:0.99, epsEstimate:2.09, …}` into `fantasyTimesConsensus/{date}.earnings.results[NVDA]` (`generate-recap.js:591-599`, `fantasyTimesConsensus.js:183-202`). **No code reads the eps/result fields of that bucket** — the only reader of `earnings.results` is the adapter's `revenue_vs_consensus`, which consumes only `revenueActual/revenueEstimate` (`wireEditorialAdapters.js:350-352`), and `buildConsensusBlock` (the prompt injection) never reads `earnings.results` at all. **VERIFIED.**
- **The editorial adapter is the real sink.** The corrupt-but-self-consistent story scores **VERIFIED_CORRECT**, counting toward the S5 ≥5-verified and ≥2-shape floors and **diluting (never raising) the derivation-error rate** — a fabricated operand makes the wire look **more** accurate and helps the gate **pass** (`wireEditorialAdapters.js:437-439`). The determinism gate structurally cannot catch it. **VERIFIED** (conditioned on the story declaring an `eps_vs_consensus` tuple in `agentFacts`; if wire writes are flag-off / no tuple declared, it is `NOT_VERIFIABLE('no_declarations')` instead — not inflating the floor, but also not caught).
- **Game / odds / rankings are insulated.** `resolve-tournament.js:72`, `tournamentResolutionService.js:147`, `odds.js:125`, and `compute-rankings` all resolve against their **own** `getEarningsResult` / EODHD `/fundamentals` path — a **different feed** from the recap's `/calendar/earnings` operand. A wrong recap actual does **not** corrupt game resolution, odds, or beat-rate rankings. **VERIFIED.** Consequence: the game would score NVDA a **beat** while the recap printed a **−52.6% miss** — two public surfaces disagreeing, with the correct value literally in-hand at recap time.
- **Trading agents see only the headline.** `decide.js:379-387` fetches the 10 latest stories, drops only `deepdive`, keeps 5, and `formatStoriesSummary` injects **reporter / beat / headline / time-ago only** — not the body or operands (`agentPromptAssembly.js:260-272`). So a wrong recap reaches agents **only through its model-generated headline's beat/miss framing**, transiently while it sits in the top-5 window. *(`decide.js` and `agentPromptAssembly.js` are §1-fenced — read-only here, **not edited**; the fix does not touch them.)* **VERIFIED.**
- **Reader feed:** the published doc (headline/body/`dataSnapshot` with `epsActual:0.99, outcome:'miss'`) renders in the FantasyTimes reader feed. **ASSUMED** (feed render not read this session).

---

## 7. Residual / latent defects found in passing — filed for separate tasking (BUILD_RULES §3)

Not fixed here; surfaced for triage:

1. **Dead consensus-revenue append.** `getEarningsResult` never returns `revenue`/`revenueEstimate` (`getEarningsResult.js:408-428`), so `revenueActual: earningsDetail?.revenue` / `revenueEstimate` in the recap's `appendEarningsResult` are **always null** (`generate-recap.js:597-598`) — the one field `revenue_vs_consensus` actually reads is never populated by this writer. VERIFIED.
2. **`ingest-earnings.js` still uses the pre-capture field names.** It reads `earning.actual_eps ?? earning.epsActual` (`:127`) — the `actual_eps`/`eps_estimate` names the capture proved are **0-populated** — so its EPS operands are effectively always null and `surprisePercent` defaults to 0. Opposite field-precedence from the recap. VERIFIED.
3. **No client-side window range check** on calendar rows (relies entirely on EODHD `from`/`to`); a TZ/off-by-one row outside the window would pass unchecked (`generate-recap.js:142-148, 253-255`). VERIFIED (structural).
4. **Duplicate-row eviction amplification** (§2): surprise-first ranking makes a more-extreme *wrong* operand outrank a correct one on a shared `report_date`. VERIFIED (structural).

---

## 8. Recommendation (for your decision — no code written)

The right fix is a **cross-source integrity gate in the non-fenced `generate-recap.js`**, upstream of publication:

- Compare the calendar `actual` against the fundamentals `epsActual` **already fetched** in `earningsDetail`, using a **relative/ratio tolerance** (not equality) to absorb the split-adjust confound, and **fail-open** when fundamentals is unresolved. On material disagreement, **hold** the candidate (same `continue`/`heldCount` path the plausibility gate uses today, `:359-367`).
- Optionally add a **loose** surprise-% *review* signal (not an auto-drop) once a review queue exists.
- This lives entirely in non-fenced code, prevents the bad story from ever being written, and therefore needs **no** contact with the fenced agent-channel or scoring files.

Because `generate-recap.js` is a `GENERATION_SURFACE` member and any prompt-byte change bumps `WIRE_GENERATION_VERSION`, a fix that only *holds* (no change to the emitted prompt on the pass path) may avoid a version bump — to be confirmed at build time.

---

---

## 9. Fix delivered (founder-approved design, 2026-08-28)

Cross-source disagree-hold as the **primary** gate; surprise-% backstop **skipped** per your instruction.

**New pure gate** — `assessEpsCrossSource` (`econPrintVerifier.js`): compares the printed calendar `actual` against the independent `/fundamentals` `actual` under a **ratio (relative) tolerance** (`EPS_CROSS_SOURCE_REL_TOLERANCE = 0.35`), **fail-open** on unresolved / absent / unparseable / off-quarter fundamentals (and a near-break-even magnitude floor). Logs both values + the ratio + relDiff.

**Wiring** (`generate-recap.js`): the gate runs in a new **pre-sort pass** over every uncovered candidate — a disagreeing candidate is made **ineligible before the surprise-first sort**, so a fabricated `−52.6%` can neither outrank a real beat nor publish. Posture: **hold with a distinct outcome code** `cross_source_disagreement`, candidate **terminal** (excluded from the firing; **no re-arm loop** — a subsequent firing self-heals only if EODHD corrects the value). The `getEarningsResult` fetch moved into this pass and is **reused** downstream (one fetch per candidate; pass-path prompt bytes unchanged).

**Design decisions honored:** ratio tolerance ✓ · fail-open on unresolved fundamentals ✓ · both values + ratio logged ✓ · distinct outcome code ✓ · terminal / no re-arm ✓ · ineligible before the surprise-first sort ✓.

**Split-confound handling:** the gate compares **only same-quarter** feeds (fundamentals must resolve within `EPS_CROSS_SOURCE_QUARTER_DAYS = 7` of the calendar `report_date`); off-quarter → fail-open. A split sits only *between* quarters, so same-quarter as-reported-vs-adjusted values don't diverge on a split — the confound is removed by construction rather than by split-factor math.

**Generation surface:** both edited files are `GENERATION_SURFACE` members, so `WIRE_GENERATION_VERSION` **22 → 23** + regenerated baseline (mechanically forced by the P2-15 content lock). The change alters *which* stories publish, not per-story prompt bytes; `TICKER_TO_SECTOR` untouched (no validator bump); editorial gate off, so the gateEpoch reset is dormant.

**Tests:** 10 new pure-gate rows (`econPrintVerifier.test.js`) + 5 handler rows (`generate-recap.crossSource.test.js`, mutation-checked: neutering the gate turns exactly the held + eviction rows red). **Full suite: 8200 passed / 62 skipped / 0 failed.** No new lint class (the `process` no-undef is a pre-existing repo-wide condition).

**Files changed (6):** `api/_utils/econPrintVerifier.js`, `api/fantasytimes/generate-recap.js`, `api/_utils/wireContracts.js` (v23), `api/_utils/wireGenerationBaseline.json` (regenerated), `api/_utils/econPrintVerifier.test.js`, `api/fantasytimes/generate-recap.crossSource.test.js`.

**Tuning note for you:** `EPS_CROSS_SOURCE_REL_TOLERANCE = 0.35` catches the ~2.24× NVDA error (relDiff 0.554) with margin while tolerating rounding/GAAP feed noise. It is a founder-tunable constant with no historical false-positive backtest available read-only — worth a calibration pass against known same-quarter GAAP-vs-nonGAAP feed splits.

## 10. Would the ignored fiscal `date` column have caught this? — No (for this mechanism)

You asked whether reading EODHD's `date` field (fiscal **period-end**, e.g. `2026-06-30`, distinct from `report_date` = announcement) would have caught the NVDA case as a quarter mismatch.

**It would not.** The `date` column answers *"is this the right quarter's row?"* — not *"is the actual value inside this row correct?"* The NVDA defect is a **wrong value (0.99) inside a correctly-dated row**: the estimate (2.09) is right-for-the-quarter, which is strong evidence the row's `report_date` **and** its period-end correctly identify the recapped quarter. A period-end check on that row passes — the operand is still wrong. The fiscal `date` column only catches the *different* mechanism where a literal prior/forward-quarter **row** is selected (period-end ≠ expected), which the correct estimate rules out here.

That is exactly why the fix compares **values across two feeds** rather than validating a date within one row. I did **capture `periodEnd` into the cross-source hold log** (zero prompt-byte cost) so the two mechanisms are distinguishable in production diagnostics — but it is **not** used as a gate, because it does not defend this defect class.

---

### Appendix — anchor table (spot-check before relying; lines drift)

| Fact | Anchor | Marker |
|---|---|---|
| Operand read (calendar) | `generate-recap.js:249,265-266` | VERIFIED |
| `deriveRecapSurprise` / call | `generate-recap.js:58-85 / :430` | VERIFIED |
| Prompt render / dataSnapshot / consensus | `generate-recap.js:438-441 / 526-534 / 591-599` | VERIFIED |
| Plausibility gate call / def | `generate-recap.js:359-367` / `econPrintVerifier.js:204-219,152,155-159` | VERIFIED |
| Editorial `eps_vs_consensus` / compare / tol | `wireEditorialAdapters.js:335-343 / 107-134 / 74` | VERIFIED |
| Fundamentals feed 7-day matcher / fallback / return | `getEarningsResult.js:296-334 / 416-421` | VERIFIED |
| Calendar schema (`date` vs `report_date`, `difference`/`percent`/`currency`) | `earningsCalendarCapture.js:6-10` | VERIFIED |
| Cron registration | `vercel.json:108-111` | VERIFIED |
| Game re-fetches fundamentals | `resolve-tournament.js:72`; `tournamentResolutionService.js:147`; `odds.js:125` | VERIFIED |
| Agents see headline only | `decide.js:379-387`; `agentPromptAssembly.js:260-272` | VERIFIED |
| NVDA tracked | `stockIntelligenceData.js:39` | VERIFIED |
| `0.99` = EODHD calendar `actual`; truth ~2.22 | live EODHD payload (not in repo) | ASSUMED |
