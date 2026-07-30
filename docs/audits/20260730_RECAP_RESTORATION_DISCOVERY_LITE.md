# Recap Restoration Mini-Arc V1.1 — CC Discovery-Lite (READ-ONLY) — HARD STOP

**Date:** 2026-07-30 · **Author:** Claude Code · **Phase:** discovery-lite → STOP (no code written)
**Spec:** `RECAP_RESTORATION_MINIARC_SPEC_V1_1.md` (branch-local; see §Open items — not committed to `docs/`)

## Session provenance (BUILD_RULES §2/§3 preamble)
- **Branch:** `claude/recap-restoration-mini-arc-v1-1-3q9apt` (cut fresh; **0 ahead / 0 behind** `origin/main`).
- **HEAD:** `97470852f280203134fe3748905b220409d55c5e` == `origin/main`. **Clean tree.**
- **`git fetch origin` run as the first step** (§3 stale-ref law). No writes to project state; reading files/grep only. `EODHD_API_KEY` **ABSENT** in this environment.
- **Method:** 14-agent read-only workflow — 7 discovery lanes, each adversarially verified by an independent skeptic. All claims below carry `file:line` + VERIFIED (read this session). Adversarial result: **5 CONFIRMED, 2 PARTIAL** (both PARTIALs strengthen the conclusion; corrections folded in).

---

## Executive verdict table (read this first)

| # | Discovery item | Verdict | One-line finding |
|---|---|---|---|
| 6 | econPrint parse path | **STOP** | There is **no econ verifier at all** — operands are raw-string passthrough; VERIFIED/NOT_VERIFIABLE is net-new build, not a fix. |
| 7 | Capture real EODHD response | **STOP (founder)** | Cannot capture here (`EODHD_API_KEY` absent) **and no EODHD econ-calendar endpoint exists** — econ comes from Sonar. No econ fixture in repo. |
| 8 | Jobless-claims Tier-1 status | **STOP** | Jobless-claims is **absent from the DRB arrays** and **not a keyword** → **not** Tier-1 today → item 8's "≤1-week bound" does **not** hold; R9 **fallback form is required.** |
| 9 | DRB agency-array cross-check | **STOP** | The importance→Tier-1 mapping **already exists** (`isTier1Event`) but runs on the **feed**, not the arrays — diverges **two ways**; founder must pick the authority. |
| 10 | Worst-case model-call delta | **CLEAR (confirm cost)** | **+23 Haiku calls / trading-day** (18 econ + 5 earnings), clamped by a one-per-fire guard; **sweep floor untouched by construction.** |
| 11 | N4/F1 disjointness | **CLEAR** | Disjoint by named files: N4 reader = `fantasyTimesConsensus.js`; F1 writer = `generate-econ.js`. |
| F1 | dual-count log + skip taxonomy | **AMEND** | Log site pinned; **`fetch_failed` has no emission site in either writer** → outage reproduces the silent zero in a new costume. |
| F2 | AMC prose honesty | **STOP (terminology)** | The into-earnings operand is the **current-session** move (`:223`); the persisted `priceMove` is the **reaction** (usually null same-evening). AMC/BMO timing **isn't surfaced to the prompt at all.** |
| C2 | prior-session walker | **STOP (scope)** | Walker is correct but **not reached** — recaps are same-day. The real fault is **UTC "today"** (`:68`/`:356`/`:394`), not date-minus-one. |
| C8 | referent dedup + consensus date | **STOP (lock collision)** | Firing-scoped receipt bucket **must not be re-keyed** (confirmed). But **C8(c) collides with a FINAL-LOCK join rule** — event-date consensus write strands the operand from its adapter. |
| — | Calibration fence | **CLEAR** | **No fence contact.** None of the target files are on the BUILD_RULES §1 list. |
| — | GENERATION_SURFACE / epoch | **STOP (confirm)** | Even logging-only/prose-only edits force **WIRE_GENERATION_VERSION 6→7** + baseline regen + gateEpoch reset. **Two sequential resets** (restore, then post-gate exemplar). |
| — | Flag posture | **CLEAR** | S3/S5 are **on-but-silent (data-gated), not dark-by-flag.** Fix does not depend on flipping `WIRE_WRITES_ENABLED`. |

**Anchors:** S3 = `neta_econ_recap` writer `api/fantasytimes/generate-econ.js`. S5 = `doug_earnings_recap` writer `api/fantasytimes/generate-recap.js`. Both are `MODEL_HAIKU` seams in `wireGenerationConfig.js:54,61`, both inside the `GENERATION_SURFACE` manifest.

---

## Part A — The five STOP surfaces the spec named (§6)

### A1 · EODHD mapping + DRB cross-check (items 8 + 9) — **STOP**
- **The mapping already exists** and is **not** array-driven: `isTier1Event` = `event.impact === 'high'` **OR** name matches `TIER_1_KEYWORDS` (`cpi/nfp/non-farm/nonfarm/payrolls/gdp/ppi/fed/fomc/interest rate/federal reserve/pce`). `generate-econ.js:36-62` (VERIFIED). **Duplicated verbatim** in `ingest-econ.js:16-19,35` — two copies must stay in sync.
- It runs on **feed events** (`calendar.thisWeek` from **Sonar**, `generate-econ.js:188-193`), **never on** the deterministic DRB arrays in `macroCalendar.js`. That is exactly why they can diverge.
- **DRB agency arrays** (`macroCalendar.js`, VERIFIED): 7 hardcoded (FOMC `high`, CPI `high`, PPI `medium`, PCE `high`, Retail Sales `high`, GDP `high`/`medium` mixed, Productivity `medium`) + 5 computed (NFP `high`, JOLTS `medium`, ISM-Mfg `medium`, ISM-Svc `medium`, Consumer Confidence `medium`). **12 categories, nothing else.**
- **Divergence A (mapping admits, arrays lack):** **jobless claims** reaches Tier-1 only via the `impact==='high'` branch (keyword path misses it — no `claims`/`jobless` token) and is **absent from every DRB array** (ripgrep over the full 424-line file: no match). Yet jobless-claims **is** a first-class Wire subject elsewhere: `wireIdentity.js:36` slug `claims`, `wireContracts.js:183` → `JOBLESS_CLAIMS`.
- **Divergence B (arrays include, mapping drops):** medium-impact DRB categories with **no matching keyword** — JOLTS, ISM-Mfg, ISM-Svc, Consumer Confidence, Productivity, GDP's medium (2nd/3rd) estimates — are classified **NOT-Tier-1** by `isTier1Event` if the feed rates them `medium`. (PPI survives via keyword.)
- **Founder must rule:** (1) which is authoritative — feed-`isTier1Event` or the DRB arrays (spec item 9 says arrays win, but the code never consults them); (2) is weekly jobless-claims **intended** Tier-1? If YES → add to `macroCalendar` (deterministic) → near-weekly S3 → R9 strong form with ≤1-week bound. If NO → the `impact==='high'` branch still leaks it non-deterministically, **and** R9 must use the fallback form (quiet weeks are real).

### A2 · The captured EODHD response (item 7) — **STOP (founder deliverable)**
- **Not capturable in this environment:** `EODHD_API_KEY` is absent (VERIFIED via env check + guard at `fetchEarningsCalendarEODHD.js:185`).
- **More fundamentally: there is no EODHD *economic-calendar* endpoint anywhere in the repo.** Only `/calendar/earnings` (earnings) is wired. Econ events come from **Sonar** (`fetchEconomicEvents`, `generate-econ.js:86-131`); the deterministic `macroCalendar.js` carries **no operands** (`date/day/time/event/impact` only).
- The only EODHD fixtures in-repo (`fetchEarningsCalendarEODHD.test.js:63`) are **earnings** rows and **omit `actual_eps`/`eps_estimate`** — so there is **no ground-truth operand-typing fixture** for earnings *or* econ.
- **Founder must capture** a representative EODHD response (live, `api_token=EODHD_API_KEY&fmt=json&from=&to=`, per `fetchEarningsCalendarEODHD.js:199`) with a provenance comment — **and first decide whether econ operands even come from EODHD** (see B1). Until the source is chosen, R2's fixture target is undefined.

### A3 · The parse-path citation (item 6) — **STOP**
- **There is no econPrint parse/verify path.** Econ operands (`actual/estimate/previous`) are **raw strings** by contract (`fetchEconomicEvents.js:24-30`: `"50.9"/"50.5"/"51.2"`) and sink **unverified** at **≥3 co-equal points** (PARTIAL correction to the "single terminus" framing):
  1. the prompt render — `generate-econ.js:250-252`;
  2. the `dataSnapshot` store — `generate-econ.js:337-339`;
  3. the consensus render — `buildConsensusBlock`, `fantasyTimesConsensus.js:288` (`Actual ${e.actual ?? 'pending'}`).
- No `parseFloat`/`Number`/`typeof` gate and **no K/M/B or % scale-normalization** exists for econ operands. A `"187K"`-vs-`187000` case today is **neither VERIFIED nor rejected — it renders the literal `"187K"`.**
- **Press-1 hazard is real for the build:** the R2 rule is **specified but unimplemented** — `PHASE2_CALIBRATION_ADDENDUM_V1_1.md:104` ("strict parse w/ optional %, K/M/B suffix, comma strip; ±0.05 for |v|<10 else ±0.5% relative; parse failure → `NOT_VERIFIABLE(unparseable_operand)`"). A naïve `Number('187K')=NaN` / `parseFloat('187K')=187` added later would misfire on scale/unit suffixes.
- The **only** pre-existing type-gated numeric compares live on the **earnings** seam and **assume numeric operands**: `generate-recap.js:201` (`epsActual > epsEstimate`), plus `earnings.js:219-220` and `earnings-history.js:217-219` (PARTIAL correction — more than the one cited). Zero on econ.
- **Consequence:** R2 (the econPrint verifier) is **net-new build, not a bug fix.** It fits in `generate-econ.js` / a new helper reading consensus operands — **none of which are fenced.**

### A4 · The budget number (item 10) — **CLEAR (confirm cost)**
- **Worst-case = +23 Haiku model calls per trading-day** (VERIFIED, adversarially CONFIRMED): **18** econ-recap fires (`vercel.json:74` `0,30 13-21 * * 1-5` = 2/hr × 9 hrs) **+ 5** earnings-recap fires (`vercel.json:86` `0 20,21,22,23,0 * * 1-5`).
- Each fire generates **exactly one** story (`generate-econ.js:234` `uncoveredEvents[0]`; `generate-recap.js:164-165` `uncoveredResults[0]`, "one per cron invocation to stay within timeout"). No extra art-director call (recap types are in `expectedTypes` → `shouldOverrideVisual` false).
- This one-per-fire guard **clamps the spec's un-clamped "(Tier-1 econ + mega-cap earnings) × 5 ≈ 25-40" down to 23**, and the 23 ceiling **holds even under total dedup regression.** All Haiku (cheapest tier); **zero on weekends/holidays.**
- **Sweep floor untouched by construction:** the sweep (`runWireReplaySweep`) runs **inside** `process-pending-reflections.js` under its own remaining-budget gate; that host **never calls** the recap generators (separate serverless invocations). Recap generation is **editorial-class budget**, structurally separate from the reserved/inviolable sweep floor (`FANTASYTIMES_WIRE_PHASE2_SPEC_V1_5.md:21`, R4-M5/P2-47).

### A5 · The disjointness assertion (item 11) — **CLEAR**
- **N4 (Neta reader cleanup)** = `api/_utils/fantasyTimesConsensus.js` — the **orphaned `economicCalendar` reader** at `:90` (`db.collection('economicCalendar').doc('latest')`), which an in-code comment at `:129-131` names "removed separately by Phase 2 N4." (`economicCalendar` has no writer in-repo.) A second read is `api/health.js:81`.
- **F1 (writer fix)** = `api/fantasytimes/generate-econ.js` (dual-count + taxonomy in `handleRecap`).
- **Disjoint by named files** — the writer never reads `economicCalendar` (it sources from Sonar). ✅

---

## Part B — Premise corrections the founder must rule on (these change the build)

> These are the substantive STOPs. Each is a place where the code contradicts a spec premise, so the build cannot proceed on the spec's wording alone.

**B1 · Econ is Sonar, not EODHD (blocks R2's whole premise).** The spec says "EODHD supplying operands only" for econ. In fact S3 sources its calendar **and** its operands from **Sonar** (`generate-econ.js:86-131,188`); EODHD in that file is only real-time SPY/QQQ prices (`:67-69`). No EODHD econ endpoint exists. **Decide the econ operand source of record:** (a) build a new EODHD `/economic-events` fetch as the trusted operand feed (then R2's fixture is capturable), (b) verify Sonar's own `actual` strings, or (c) source from deterministic `macroCalendar` (which today carries **no** operands). This choice defines what R2 parses and whether A2's capture is even meaningful.

**B2 · C2's "prior session" is never reached.** Both recaps are **same-day** (today's released prints / today's earnings). Neither writer computes a prior session, so **neither commits the date-minus-one fault C2 warns about.** The walker `getPreviousTradingDay` (`marketSchedule.js:141-153`) is **correct** (walks weekends + NYSE holidays, 2026∪2027) and is already used correctly by the one place that needs it (`seedConsensus`, `fantasyTimesConsensus.js:48`). **The real recap date fault is UTC-clock "today":** `generate-recap.js:68` (earnings fetch `from=to=UTC-today`) and the consensus appends at `generate-recap.js:356` / `generate-econ.js:394`. **Founder must decide:** does the mini-arc introduce a prior-session lookback into recaps, or is C2 really "fix the UTC derivation to ET"? (If routing recap dates through the walker near 2027→2028, note it **lacks** the maintained-year guard that `wireCalendar.assertMaintainedYear` has — 2028 holidays would silently read as sessions.)

**B3 · C8(c) collides with a FINAL-LOCK join rule.** The receipt-bucket half of C8 is **confirmed and should be honored** — the Wire receipt/day-doc bucket is firing-scoped, B5-immutable (`wireWriteThrough.js:244,279` "First receipt wins"), and **must not be re-keyed.** But C8(c) ("consensus write lands on the event's date") **conflicts with a locked rule**: the consensus operand write currently lands on the **UTC firing date** (`generate-recap.js:356`, `generate-econ.js:394`), and `PHASE2_CALIBRATION_ADDENDUM_V1_1.md:78` (FINAL LOCK §3) pins **both** the writer **and** the Phase-2 adapter join (`story.publishedAt` → same UTC expression, "never from the Wire marketDate") to that firing date. **Re-keying the write to the event date without migrating the adapter join in lockstep strands the operand in a doc the adapter never reads.** Founder must rule whether C8(c) overrides locked §3, and if so how the adapter migrates together.

**B4 · C8 dedup: it exists, but firing-day/name-scoped, not referent-scoped.** Both writers **do** skip pre-model-call (zero model calls) — `generate-recap.js:141-151` (symbol + today) and `generate-econ.js:211-221` (`dataSnapshot.eventName` + today). Neither keys on the **referent** `(symbol,reportDate)` / `(slug,releaseDate)`. **The 5× re-generation risk applies to S3 only** (PARTIAL correction): S3's fetch returns the **whole week** (`calendar.thisWeek`), so a released Tier-1 event with a persisting non-null `actual` re-generates **each subsequent day** because the today-scoped dedup can't see yesterday's story. **S5 is not multi-day** — `fetchTodaysEarnings` is a strict single-day window (`generate-recap.js:68`); its dedup gap surfaces instead as the **UTC-`todayStr` vs ET-`startOfDay` boundary** mismatch. Implementing referent dedup needs a **schema addition** the founder should approve: neither story persists its referent **date** queryably (`generate-econ.js:334` has `eventName` but no date; `generate-recap.js:299` has no `reportDate`), and the query must exclude **superseded** stories and span the **event's** window, not "today."

**B5 · F2 targets the current-session operand, and timing isn't surfaced.** `DOUG_RECAP_SYSTEM_PROMPT` contains **no** price-move phrasing (`fantasyTimesPrompts.js:393`) — there is no fixed dishonest string to delete; the risk is model prose over the injected operand. For **AMC** names the persisted `priceMove` is the **close→next-close REACTION** (`getEarningsResult.js:135-136`), which is **typically null at same-evening recap time** (no next-day close yet) → the `:222` "After-hours price move" line is filtered out, leaving **`generate-recap.js:223` "Current price (changePercent)"** — the EODHD real-time `change_p`, i.e. the **into-earnings** move — as the sole live operand. **AMC/BMO timing is never read into the prompt or `dataSnapshot`** (the `:176` comment even mislabels the into-earnings operand "current price reaction"). **Founder must confirm:** (1) the fix relabels the **current-session** operand as "into-earnings (pre-reaction)" for AMC (not the persisted `priceMove`); (2) surfacing timing (`earningsDetail.beforeAfterMarket`) is in scope; (3) the reaction-day move as a **new field** is deferred post-gate (it forces a version bump **and** a verification-adapter change per addendum §6).

**B6 · The `fetch_failed` taxonomy code has no emission site.** Both writers already distinguish `empty_window` / `already_written` / `wrote` by message, but a Sonar (`generate-econ.js:174`) or EODHD (`generate-recap.js:380`) outage collapses into a **generic 500 catch — indistinguishable from an empty window.** This is the exact "silent zero in a new costume" the spec warns of. F1 must add a distinct `fetch_failed` code at each outer catch, or the outage remains greppable only as a generic failure. (Also: F1's dual-count is **absent** on S3's zero path — `events.length` is never logged, `releasedTier1.length` only when >0; S5 logs both but on two separate lines, `:110`/`:127`.)

**B7 · The version bump is unavoidable — plan two epoch resets.** `WIRE_GENERATION_VERSION` is **6** (`wireContracts.js:64`); the committed baseline (`wireGenerationBaseline.json:12`, hash `c02dc0bc…`) fails CI on any `GENERATION_SURFACE` diff without a bump. F1 (`generate-econ.js`, `generate-recap.js`), F2 (`fantasyTimesPrompts.js`, `generate-recap.js`), and any seam-config touch (`wireGenerationConfig.js`) are **all surface members** → **6→7 + baseline regen**, which **resets `gateEpoch`** (`FANTASYTIMES_WIRE_PHASE2_SPEC_V1_2.md:60-61`) and restarts the two-period gate window (= the spec's "R9 observation window"). Per the Jul-29 ruling (`PHASE2_N2_PARTIAL_EXEMPLAR_RULING_JUL29_2026.md:32`), there are **two sequential resets**: the restoration bump, then the **post-gate exemplar embedding** bump (neta econ_recap + doug earnings_recap exemplars are deferred and gated on **these very fixes** producing real stories). Confirm this is acceptable and sequence accordingly (see Part D).

**B8 · Flag posture: on-but-silent, not dark.** All three Wire flags ship false (`featureFlags.js:1075`), and there is **no per-seam enable flag** (`wireFlags.js:24`). With `writesEnabled` off, `publishStoryWithWire` still does a plain `.add(storyDoc)` (`wireWriteThrough.js:104`) and the **Haiku call precedes it unconditionally** — so S3/S5 are silent because of **data gates** (Sonar `actual` null; AMC `actual_eps` absent at cron time), **not** a flag. The fix must not depend on flipping `WIRE_WRITES_ENABLED`.

---

## Part C — Clearances (no founder action needed, recorded for the register)
- **Calibration fence: CLEAR.** None of `generate-econ.js`, `generate-recap.js`, `wireGenerationConfig.js`, `fantasyTimesConsensus.js`, `marketSchedule.js`, `fantasyTimesPrompts.js`, `wireWriteThrough.js`, `fetchEarningsCalendarEODHD.js` are on the BUILD_RULES §1 list (agent* only). No fence contact for any proposed fix.
- **N4/F1 disjoint** (A5). ✅
- **Sweep floor untouched by construction** (A4). ✅
- **Import/scoring rules (§4):** no scorer copy introduced by this arc; not applicable.

---

## Part D — Merge-order / epoch-sequencing law (spec §6)
1. **Mini-arc PR** (F1/F2/C2/C8 + the R2 verifier) → bumps `WIRE_GENERATION_VERSION` 6→7, resets `gateEpoch`.
2. **Deferred-exemplar PR** (neta econ_recap + doug earnings_recap exemplars) → **can only be built after step 1's fixes produce real stories** in production, then embeds and bumps 7→8.
3. **Both must merge before the R9 (two-period) observation window opens.** Any later `GENERATION_SURFACE` merge — this arc **or** the exemplar PR **or** the flip-runway generation surface — **restarts the window.**
4. Founder merges everything. **Pushed ≠ deployed.** R9 proves **generation liveness only**; **R2 offline proves VERIFIED-capability** (zero typed entries exist pre-flip by construction).

---

## Part E — Residual defects found (BUILD_RULES §3 — filed for SEPARATE tasking, not fixed)
1. **Hardcoded `-05:00` (EST) dedup day-boundary** is wrong in EDT summer by one hour: `generate-recap.js:139`, `generate-econ.js:209,426`.
2. **`getPreviousTradingDay` lacks a maintained-year guard** (silent mislabel past 2027) — `marketSchedule.js:141`; header TODO flags 2028 (`:10`).
3. **`isTier1Event` + `TIER_1_KEYWORDS` duplicated** in `generate-econ.js` and `ingest-econ.js` — must edit both or they silently disagree.
4. **Consensus SEED (ET) vs operand append (UTC) divergence** after 8 pm ET — a post-8pm recap appends into a UTC-tomorrow doc the ET seed never created (`process-draft-claims.js:553` vs the two appends).
5. **`submit-earnings-batch.js:145` preview dedup is all-time symbol-only** (would suppress a fresh quarter's preview).
6. **`:176` comment "Fetch current price reaction"** mislabels the into-earnings operand.
7. **Dead client copy** `src/prompts/fantasyTimesPrompts.js` (`DOUG_RECAP_SYSTEM_PROMPT` duplicate, server path doesn't render it) — drift risk.

---

## Part F — Adversarial verification ledger
| Lane | Crux | Verdict | Correction carried |
|---|---|---|---|
| L1 silent writers | S3 silence = Sonar `actual`-null gate | **CONFIRMED** | Silence is behavioral/data-source, not a hard structural guarantee (crux hedges "common case"). |
| L2 parse path | No type-gated econ verifier anywhere | **PARTIAL** | ≥3 raw sinks (not "sole terminus"); more earnings-side numeric compares than cited. Conclusion unchanged/strengthened. |
| L3 Tier-1 mapping | Jobless-claims absent from arrays, admitted by `impact:high` | **CONFIRMED** | Minor: S3 feed is Sonar (EODHD = prices only). |
| L4 dedup/bucket | Receipt bucket firing-scoped + no referent dedup | **PARTIAL** | Multi-day 5× applies to **S3 only**; S5 is single-day (boundary mismatch, not multi-day). |
| L5 walker | Walker correct but not reached; real fault is UTC-today | **CONFIRMED** | — |
| L6 prose honesty | AMC earnings-day operand = into-earnings; `priceMove` = reaction (null same-eve) | **CONFIRMED** | — |
| L7 budget/cron | +23 Haiku/day ceiling; sweep floor untouched | **CONFIRMED** | Non-Haiku Sonar call per econ fire is pre-existing, not "added." |

---

## Open items / questions for the founder
- **Spec not committed:** `RECAP_RESTORATION_MINIARC_SPEC_V1_1.md` is not in `docs/` (only this branch + the referenced Jul-29 ruling + diagnosis). Confirm where item-10/§1/§6 references live so anchors stay stable.
- **"R9 observation window"** is the mini-arc's name for the V1.2 N3.4 two-period gate window (both periods share one unchanged `gateEpoch`). Confirm equivalence.
- **Does the live feed rate jobless-claims `high` or `medium`?** Not determinable from code; decides whether Divergence A fires in practice.
- **Is the Tier-1 candidate set all 12 `macroCalendar` categories or only the `high` subset?** Changes which divergence direction is the real defect.

## Recommendation & STOP
Discovery-lite is complete and adversarially verified. **No code has been written; nothing pushed.** The build should **not** start until the founder rules on **B1 (econ operand source), A1/8 (Tier-1 authority + jobless intent), B3 (C8(c) vs the locked join), B2 (C2 scope), B5 (F2 target + timing), and B7 (accept the two epoch resets)** — these six determine what R2 even parses, whether R9 needs its fallback form, and whether C8(c) is buildable without breaking the locked adapter join. **CC STOPS here for founder review.**
