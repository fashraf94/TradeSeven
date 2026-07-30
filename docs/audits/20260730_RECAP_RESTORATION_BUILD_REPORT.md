# Recap Restoration Mini-Arc — Build Report

**Date:** 2026-07-30 · **Branch:** `claude/recap-restoration-mini-arc-v1-1-3q9apt` · **Base:** `origin/main` @ `9747085`
**Governing docs (committed as the first build commit, `e296af75`):** `RECAP_RESTORATION_MINIARC_SPEC_V1_1.md` + `RECAP_RESTORATION_DISCOVERY_RULINGS_JUL30_2026.md` + `audits/20260730_RECAP_RESTORATION_DISCOVERY_LITE.md`.

## Executive verdict table

| Item | Ruling | Status |
|---|---|---|
| Docs-first commit (D-P2-11) | header | ✅ Done — **spec V1 not committed** (not in session; regeneration forbidden → founder-to-add, flagged in README) |
| EODHD econ-events fetch + capture script | R-B1 | ✅ Built (`fetchEconomicEventsEODHD.js`, `capture-econ-events-eodhd.js`) — **founder capture run still OPEN, pre-merge** |
| Plausibility gate + settle delay | R-B1a | ✅ Built (`econPrintVerifier.js`) — band table below, publication-side only, F-M4 untouched |
| Array-driven Tier-1 + jobless claims | R-A1 | ✅ Built — `isTier1Event` retired from the recap gate; `Jobless Claims` category added (weekly Thu, holiday shifts earlier) |
| C8(c) superseded — locked UTC join stands | R-B3 | ✅ Honored — consensus keys on the publish instant with the locked UTC expression; midnight-coherence test row added. **See the R-B2(i) tension note below** |
| ET derivations + cron re-aim | R-B2 | ✅ Built — ET windows via `deriveMarketDate`; recap cron `0 13,20,21,22,23 * * 1-5` (entry count unchanged, C3 intact); `assertMaintainedYear` asserted on the walker path |
| F2 generalized labels + timing surfaced | R-B5 | ✅ Built — deterministic `describeSessionMove(timing, isPriorSession)`; `beforeAfterMarket` in prompt + top-level metadata; `:176` mislabel comment fixed; Doug prompt honesty rule added |
| Referent dedup, top-level `referentDate` | R-B4 | ✅ Built — (type, referent, referentDate, non-superseded) pre-model-call, zero model calls on hit; composite index declared |
| `fetch_failed` + dual-count single line | R-B6 | ✅ Built — both writers + the preview path; dual count on EVERY firing incl. the zero path |
| ONE pre-window epoch reset | R-B7 | ✅ `WIRE_GENERATION_VERSION` 6→7, baseline regenerated once over final content |
| Tests | — | ✅ **79 new tests green** (29 verifier + 16 matcher/settle + 4 jobless + 6 calendar helpers + 24 handler rows, incl. the review-driven H1/H2/M1–M4/L1–L3 cases); full-suite run recorded below |
| Adversarial review (§2) | — | ✅ Run (22 files > threshold; `/code-review` unavailable in-session) — 2 high / 5 medium / 4 low findings, **9 fixed in the fix-forward commit**, 1 deferred to the capture gate, rest registered; table below |

## What a firing looks like now (plain language)

**Neta econ recap (S3):** every 30 minutes, the writer takes the day's (plus prior session's) official release calendar from our own deterministic arrays — never a search model — asks EODHD only for the numbers, refuses numbers that don't parse or that sit impossibly far from consensus (`operand_implausible`), waits one tick after each release for revisions to settle, checks "did we already write this exact release?" before any model call, and only then generates. Sonar still powers the Sunday preview.

**Doug earnings recap (S5):** four evening firings cover same-day results; the fifth firing now runs pre-market and recaps *yesterday evening's* AMC reports, whose EPS numbers exist by morning — this is the fix that un-silences the seam. Every price figure carries an honest label: a same-evening AMC number is the *into-earnings* move (the report drops after the close), and Doug's prompt now forbids narrating it as a reaction to the news.

Every firing of both writers ends in exactly one greppable line:
`outcome=<fetch_failed|empty_window|already_written|operand_implausible|wrote> fetched=N tier1|tracked=M`.

## R-B1a band table (proposed by CC per the ruling; constants in `econPrintVerifier.js`)

Two arms; a print is held only when **both** are exceeded — absolute band (below, in the category's conventional print unit) OR 50% of the larger operand. The relative arm keeps the gate honest when both operands share an unexpected-but-consistent unit; the absolute arm catches the mismatch class (cents-for-dollars, sibling-series values) where the operands disagree about units.

| Category | Absolute band | Unit |
|---|---|---|
| FOMC | 1.0 | percentage points |
| CPI / PPI / PCE | 2.0 | % MoM |
| Retail Sales | 5.0 | % MoM |
| GDP | 5.0 | % annualized QoQ |
| Productivity | 8.0 | % annualized QoQ |
| NFP | 500 | thousands of jobs |
| JOLTS | 4000 | thousands of openings |
| ISM Mfg / ISM Svc / Consumer Confidence | 25 | index points |
| Jobless Claims | 300 | thousands of claims |
| Earnings surprise (EPS) | 5 | dollars |

Deliberately loose (mis-mapping catcher, not close-call adjudicator). Escalation path if memos show plausible-but-wrong values passing: Sonar concurrence as logged ADVISORY (P9), then agency-direct APIs — register, post-gate, per R-B1a.

## File map (`file:line` citations at this branch's HEAD)

| File | Change |
|---|---|
| `api/scripts/capture-econ-events-eodhd.js` | NEW — R-B1 founder capture script (read-only; env self-load; HARD-STOP messaging on 402/403/404) |
| `api/_utils/fetchEconomicEventsEODHD.js` | NEW — econ operand fetch + `ECON_CATEGORY_MATCHERS` (avoid-lists fail closed) + settle gate (`isSettled`, `SETTLE_DELAY_MINUTES=30`) |
| `api/_utils/econPrintVerifier.js` | NEW — single parse authority (`parseEconOperand`: %, K/M/B/T, commas), `verifyEconPrint` (VERIFIED / NOT_VERIFIABLE(missing\|unparseable)), `operandsEquivalent` (addendum-§6 tolerance, publication-side), two-arm plausibility gates |
| `api/_utils/macroCalendar.js` | `getJoblessClaimsDates` (weekly Thu 8:30 ET, holiday → prior business day) + wired into `getMacroEventsInWindow`; header updated |
| `api/_utils/wireCalendar.js` | `startOfEtDay` (DST-correct ET midnight) + `assertMaintainedYear` exported |
| `api/_utils/fetchEarningsCalendarEODHD.js` | `translateTiming` exported (single timing vocabulary) |
| `api/fantasytimes/generate-econ.js` | `handleRecap` rewritten (array-driven, EODHD operands, gates, taxonomy, referent dedup, priority high-first); `isTier1Event`/`TIER_1_KEYWORDS` removed; preview: Sonar kept, `fetch_failed` wrap + ET day boundary |
| `api/fantasytimes/generate-recap.js` | ET windows + morning fire (prior-session AMC + same-day BMO through `getPreviousTradingDay`, horizon-asserted); timing surfaced; `describeSessionMove` labels; EPS plausibility; taxonomy + dual count; referent dedup; `:176` comment fixed; consensus same-instant |
| `api/_utils/fantasyTimesPrompts.js` | Doug recap prompt: one honesty rule (labels govern attribution; into-earnings ≠ "moved on the news") |
| `api/_utils/wireGenerationSurface.js` | Manifest + the two new modules (rationale comment; macroCalendar deliberately excluded — see flag below) |
| `api/_utils/wireContracts.js` | `WIRE_GENERATION_VERSION` 6→7 (v7 changelog entry) |
| `api/_utils/wireGenerationBaseline.json` | Regenerated once over final surface content (regen gate: content + forward bump) |
| `vercel.json` | Recap cron `0 20,21,22,23,0` → `0 13,20,21,22,23` (same entry, C3 intact) |
| `firestore.indexes.json` | Composite (type ASC, referentDate ASC) on `fantasyTimesStories` |
| Tests | `econPrintVerifier.test.js` · `fetchEconomicEventsEODHD.test.js` · `macroCalendar.joblessClaims.test.js` · `wireCalendar.startOfEtDay.test.js` · `generate-econ.recapRestoration.test.js` · `generate-recap.recapRestoration.test.js` |

**Fence:** no fenced file read-path changed and none edited (BUILD_RULES §1) — the arc touches no `agent*` file. **Import rule (§4):** no scoring math copied; no new `src/` import into `api/`.

## Founder flags (decisions embedded in this build — review these first)

1. **R-B2(i) vs R-B3 tension, resolved in favor of the lock.** R-B2(i) listed the consensus appends (`generate-recap.js:356`, `generate-econ.js:394`) among the UTC→ET fixes, but R-B3 upholds the FINAL-LOCK §3 join whose key IS the locked UTC expression. Converting those two sites to ET would strand operands from the (locked) adapter join. Resolution: the **fetch windows and dedup boundaries** are ET-fixed per R-B2(i); the **consensus keys stay on the locked UTC expression**, now evaluated on the *same instant* as `publishedAt` (previously a second `new Date()` could split across midnight) — which makes the R-B3 midnight-coherence row provable, and it is tested. If R-B2(i) really intended ET consensus keys, that is a supersession of the FINAL-LOCK addendum and needs an explicit ruling.
2. **R2 provenance fixture is OPEN.** The battery runs and passes on a shape-accurate sample **marked `PROVENANCE: SYNTHETIC`** in `econPrintVerifier.test.js`. Per R-B1/R-B1a the founder runs `node api/scripts/capture-econ-events-eodhd.js`, we eyeball the rows together (freshness + matcher-table validation), and the captured rows replace the synthetic block. **If the endpoint 402/403/404s → HARD STOP re-scope (the script says so itself).** Recommended as a pre-merge gate.
3. **`macroCalendar.js` is NOT in the generation-surface manifest** (rankingConfig precedent: it also feeds the DRB, and file-level inclusion would reset gateEpoch on every annual calendar refresh). Consequence: a Tier-1 array edit alone won't force a version bump. A value-lock on the array exports (GENERATION_VALUE_EXPORTS pattern) is the clean follow-up if you want that tripwire — register item.
4. **Jobless claims rows now appear in the DRB calendar too** (macroCalendar is shared; the DRB renderer will show weekly claims rows). Judged consistent with R-A1's intent; flagging the visible side effect.
5. **Morning-fire mode threshold** is ET-hour < 12 (DST-robust, from the clock not the cron slot). The 13:00 UTC slot = 9:00 AM EDT / 8:00 AM EST — pre-market in both regimes; winter BMO reports posting after 8:00 ET are picked up by the same-day evening fires (window overlap + dedup make this safe).
6. **`isTier1Event` removed from `generate-econ.js` only.** The `ingest-econ.js` twin is untouched (different consumer, per the ruling's "unchanged for other consumers this arc"); the duplication itself stays on the register.

## Acceptance matrix → test map

| Row | Test |
|---|---|
| R2 number/string/null/scaled → VERIFIED vocabulary | `econPrintVerifier.test.js` "R2 battery" (4 rows + garbage) |
| R2 degrade live (missing estimate publishes) | `generate-econ.recapRestoration.test.js` "R2 degrade row live" |
| C2 00:30 UTC boundary | both handler suites ("00:30 UTC boundary"; econ window assert) |
| C2 Monday 07:00 ET → Friday | `generate-recap` "Monday 07:00 ET morning fire" + `wireCalendar.startOfEtDay.test.js` |
| C2 day-after-holiday → pre-holiday | `generate-recap` "day-after-holiday" + walker fixture |
| C8 A6: already-written → 0 model calls | both handler suites |
| C8 A6: unknown-timing both windows → exactly one | `generate-recap` "unknown-timing row" |
| C8(b) non-superseded | `generate-recap` "superseded story does NOT satisfy" |
| R-B3 UTC-midnight coherence | `generate-recap` "R-B3" + econ consensus-key assert |
| Taxonomy codes greppable (R1/R3 amendment) | "R-B6 taxonomy" describes in both suites |
| F1 dual count incl. zero path | "empty_window: dual-count on the zero path" |
| R-B1a settle + bands (econ + EPS) | verifier suite + both handler `operand_implausible` rows |
| R-A1 membership + priority + claims | econ suite (3 rows) + `macroCalendar.joblessClaims.test.js` |
| Cron re-aim + C3 count | `generate-recap` "cron re-aim fixture" |
| Version-bump lock | `wireGenerationSurface.test.js` (regen gate exercised: restore → single regen over final content) |

## R9 runbook line (verbatim posture)

R9 proves **generation liveness only**: post-merge + deploy, S3 and S5 each write ≥1 production prose story pre-flip (claims' weekly cadence gives S3 the ≤1-week bound — strong form). The S3 fallback stays available: `outcome=empty_window fetched>0 tier1=0` + founder calendar cross-check distinguishes "quiet world" from "wrong mapping". VERIFIED-capability is proven solely by R2 offline; zero typed entries exist pre-flip by construction. Sequence: this PR + the N2 exemplar PR merge → R9 observed → two-period window opens (ONE epoch reset, R-B7); deferred exemplars land post-gate.

## Register additions from this build

1. Value-lock for macroCalendar Tier-1 arrays (flag 3).
2. Remaining `-05:00` day-boundary sites outside this arc's files (per the rulings' Part-E disposition).
3. `marketHolidayCheck.isMarketHolidayToday` reads the UTC date — post-re-aim both recap crons fire inside UTC==ET-day-safe hours so it cannot misfire *here*; other crons unaudited (pre-existing class).
4. `ingest-econ.js` duplicated Tier-1 classifier (unchanged this arc).
5. Consensus seed ET vs append UTC doc-splitting (R-B3: cosmetic, stays).
6. Reaction-day move as a new field: post-gate (version bump + adapter change), per R-B5.

## Test evidence

- New suites: **79 passing** (see map above; includes the review-driven cases).
- `wireGenerationSurface.test.js`: 15 passing including the regen-gate direction checks; the baseline was regenerated against the main-committed v6 baseline over the final (post-review) surface content — the branch lands as ONE 6→7 bump (R-B7).
- **Full suite after the fix-forward: 6231 passed / 0 failed / 53 skipped (352 files).** The only build collateral was 8 pre-existing exact-window assertions in `macroCalendar.test.js` / `fetchMacroEvents.test.js` that now see the weekly claims rows — updated to the new expected contents with R-A1 cited in place (including the "quiet week" test, whose premise — a zero-event week — R-A1 deliberately abolished).
- BUILD_RULES §2 review threshold (≥10 files / ≥1500 lines) exceeded (22 files, ~2075 insertions): `/code-review` is not available in this session, so an adversarial review agent was run over the staged diff in its place; findings + dispositions in the table above.

## Adversarial review (BUILD_RULES §2) — findings + dispositions

An independent adversarial review agent executed the staged diff's edge cases (not read-only inspection: findings were confirmed by running the modules). Verdict: **contract compliance clean** — C1 dataSnapshot key sets byte-identical, consensus lock (R-B3) verified as the literal locked expression on the publish instant, receipt bucket/idempotency untouched, zero fence contact. Findings and what was done (all fixes in the fix-forward commit):

| # | Severity | Finding | Disposition |
|---|---|---|---|
| H1 | high | Pre-9:30-ET firings rendered real-time quotes under "reaction"-class labels (quote may still reflect the prior session) — the F2 mislabel class via a side door | **FIXED** — pre-open detection (`etMinutesOfDay < 570`): S3 relabels the block `MARKET SNAPSHOT (pre-open … do NOT attribute)`; S5's `describeSessionMove` gains a pre-open variant with the same instruction; both tested pre- and post-open |
| H2 | high | `parseEconOperand(',')` fabricated a VERIFIED 0.0 print (digitless comma strings) | **FIXED** — regex requires a digit; tested |
| M1 | medium | Count-category bands were 1000× unit-mismatched vs K-normalized operands → recession-class legitimate prints (claims 510K vs 225K, NFP −300K) were held | **FIXED** — NFP/JOLTS/Claims bands re-expressed in raw units; the newsworthy-print cases now pass, tested. Residual: with raw-unit bands, an operand-pair unit DISAGREEMENT below the band magnitude can pass — accepted (gate is deliberately loose; capture run validates the feed's scale convention; escalation path stands per R-B1a) |
| M2 | medium | EPS band 5 held legitimate GAAP mega-beats (8.00 vs 1.50) permanently | **FIXED** — band 20; cents-for-dollars (~100×) still fails both arms; tested both directions |
| M3 | medium | Retail Sales matcher lacked `core` in its avoid list → `Core Retail Sales MoM` silently substituted for the headline | **FIXED** + test |
| M4 | medium | Placeholder-string actuals (`''`/`'-'`) counted as "released" → held as `operand_implausible`, polluting the R-B6 taxonomy R9 reads | **FIXED** — released = parse-aware (missing-marker actual ⇒ not released ⇒ `empty_window`); garbage actual still held loudly |
| M5 | medium | FOMC operand shape (range strings like `'4.75-5.00'`, unexpected `type`) is a single point of failure for the marquee event | **DEFERRED to the capture gate** — the founder capture window contains the Jul 28–29 FOMC row; eyeball it specifically before merge (PR checklist) |
| L1 | low | ISM sub-index rows (`Business Activity`) could substitute for the headline PMI | **FIXED** (both ISM avoid lists) + test |
| L2 | low | A row without `report_date` would throw in real Firestore (`where(…, undefined)`) and write an undefined referent | **FIXED** — strict date-shape filter on ingestion |
| L3 | low | `'3.2K%'` parsed as 3200 (suffix+% combined) | **FIXED** — combination rejected; tested |
| L4 | low | R-A1 makes the NFP holiday-shift rule load-bearing (date-equality match): a BLS earlier-shift month yields a silently missed NFP recap | **REGISTER** — date-window match tolerance as the eventual fix (pre-existing rule, elevated consequence) |
| INFO | — | `getJoblessClaimsDates(2026)[0]` dated 2025-12-31 (New-Year Thursday shifts into the prior year) | Confirmed benign (window filtering handles it) |
| INFO | — | `operandsEquivalent` reproduces the locked F-M4 tolerance arithmetic (disclosed, test-only, zero production callers) | **REGISTER** — bind to the adapter when P3 lands to prevent drift-race |
| INFO | — | Econ visual (`ComparisonBar`) renders for the first time now that operands are numbers (previously NaN'd on Sonar strings) | Noted — new visible surface; displays the bare number with no `%` unit (cosmetic, register) |

## Register addition (found during self-review)

7. **Pre-arc stories are invisible to the referent dedup** — stories written before this build carry no `referentDate`, so the `where('referentDate','==',…)` query cannot match them. Review confirmed this matches real Firestore semantics and is bounded: both seams were structurally silent pre-arc, so the worst case is a one-time duplicate on cutover day. No backfill needed; noted for the R9 observation window.

---

## ADDENDUM (Jul 30, same day) — Capture-gate closure

The founder ran the capture script twice (7-day + full-July windows) and issued `ECON_CAPTURE_FINDINGS_AND_MATCHER_RULINGS_JUL30_2026.md`. **The R-B1 HARD STOP does not fire** — `/economic-events` is live on the plan. All §5 build actions executed:

- **Artifacts committed** at `api/_utils/__fixtures__/econCapture20260730.json` (106 rows) + `econCaptureJulyFull.json` (425 rows, 200 distinct types), unescaped from the founder's uploads and JSON-validated (row counts match the memo's provenance table exactly).
- **R2 fixture swapped to CAPTURED rows** (`econPrintVerifier.test.js`): provenance names the artifact/window/capture instant; the FOMC row closes review M5 (**numeric 3.75, not a range string**); the estimate-null degrade is documented as ROUTINE (~57% of rows); string/K-M-B variants are kept but labeled DEFENSIVE — the feed is numeric-only.
- **Matcher table rewritten to §1's exact-equality rules** (`ECON_CATEGORY_MATCHERS`): cleaned-`type` EXACT match + `comparison` keying (CPI→`Inflation Rate`@yoy per the founder ruling; PPI→`Producer Price Index`@**yoy** — the observed mom row carries no estimate, so yoy is the verifiable print, deviation noted in-code; PCE@mom, GDP@qoq, Retail@mom). The substring/avoid mechanism is retired — sibling prints are structurally excluded, and every §1 avoid-list string is tested by its LITERAL observed form (45-test matcher suite incl. a full-July sweep of every Tier-1 array event against all 425 rows). ISM dual-name resolves to exactly one row (§3.3).
- **JOLTS: searched, then dropped** (§2) — zero hits across 425 rows under jolts / job openings / labor turnover / quits / hires. Removed from `getMacroEventsInWindow` with the in-code reason; `getJOLTSDates` stays exported for reference. **Productivity: array entry kept, deliberately UNMAPPED** pending an August-window capture — unmapped cannot mis-fire.
- **Bands re-denominated to the feed's OBSERVED units** (thousands for claims/NFP — captured claims actual `187` = 187K). This reverses the review-M1 raw-unit calibration, which was built for the synthetic pre-capture world; the unit doctrine is now provenance-pinned in `PLAUSIBILITY_BANDS`' header, and an operand-pair unit-disagreement case (raw 187000 vs thousands 212) is tested as HELD.
- **Parse-as-UTC asserted** on row timestamps (§5.4) — `rowDateOnly` takes the UTC date from the string itself, machine-TZ-independent, tested on the captured FOMC timestamp.
- **Tier-1 value-lock FOLDED** (§5.6, trivial): `TIER1_CALENDAR_VALUE_LOCK` (the full event set over the maintained horizon) joins `GENERATION_VALUE_EXPORTS`, so a Tier-1 set change forces a `WIRE_GENERATION_VERSION` bump while `macroCalendar.js` stays outside the path manifest (DRB-shared). Baseline regenerated against main's v6 — still ONE 6→7 bump (R-B7).
- **New capture-confirmed evidence for register item L4:** July 2026 NFP released **Thu Jul 2** while the computed rule (holiday forward-shift) dates the array event Mon Jul 6 — the BLS earlier-shift divergence is real, so July-class months miss their NFP recap until the date-window tolerance lands. Asserted as a documented non-match in the fixture sweep.
- §4 incidental validation recorded: the feed carries ten `Fed [Name] Speech` rows the retired keyword matcher would have admitted as Tier-1 with null operands — R-A1 eliminated the class before it fired.

*ADDENDUM — capture gate closed; PR ready for founder merge.*

*RECAP_RESTORATION_BUILD_REPORT — 2026-07-30*
