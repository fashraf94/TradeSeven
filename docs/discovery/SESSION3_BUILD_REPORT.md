# LEVELSTORY — SESSION 3 BUILD REPORT
## Level Construction + Lineage Engine (`02-build-levels.js`)

**Session:** LevelStory Session 3 — point-in-time level registry with availability assertion and stable level lineage.
**Branch:** `claude/level-study-session3-levels-lineage-8v31gp` @ cut from `origin/main` `9aaef370` (HEAD == origin/main asserted at branch creation).
**Date:** 2026-07-12.
**Phase A (build + synthetic/fixture tests):** ✅ COMPLETE — all tests green.
**Phase B (real-data run + sanity stats):** ⏭️ **SKIPPED** — `research/level-study/data/` is not present in this session's environment (per prompt §0.2 the founder runs Phase B locally; exact instructions in §5 below).

---

## 1. Executive verdict table

| Item | Verdict |
|---|---|
| Config patch (5 founder rulings: tod buckets, EOD fallback, half-day, SPHB/SPLV daily-only, sectorMap) | ✅ Applied; `STUDY_CONFIG_VERSION` still 1 (consumers were unbuilt) |
| Rulings doc `LEVELSTORY_RULINGS_AND_AMENDMENTS_S3.md` | ✅ Written (rulings §A + application-choice register §B) |
| Traceability table update | ✅ Updated (flag #6 closed, sectorMap closed, S3 rows added) |
| `02-build-levels.js` + `lib/level-series.js` + `lib/level-sources.js` + `lib/lineage.js` | ✅ Built — structural/participation/calendar sources, availability triple, family-counted confluence, full lineage engine (match/EMA anchor/merge/split/retire/role log) |
| Phase A required tests (8 groups, S3 prompt §3.7) | ✅ **17/17 green** in this environment |
| S2 suite regression | ✅ Both S2 fixture-based files (10 tests) still green; the 44 data-dependent S2 tests cannot run here (no `data/` — see §4) |
| Equivalence harness (incremental ≡ truncated rebuild) | ✅ Required test, passing — on committed real-market fixtures AND implicitly on every synthetic scenario via shared code path |
| Phase B run + sanity stats | ⏭️ Skipped with note — founder runs `npm run levels` locally (§5) |
| Artifacts committed? | ❌ Never — `data/levels/` verified covered by `.gitignore:83` (`research/level-study/data/`) |
| Fence contact / product imports | ❌ None — zero `src/`/`api/` imports anywhere in the study |
| Event detection / episodes / features / outcomes | ❌ Not built (Session 4+ scope, per HARD STOP) |

**One item needs founder eyes:** ruling request **S3-C7** (calendar pivot tradability — §6 below). Everything else is transcription or conservative convention, all ⚠-flagged.

---

## 2. What was built

### 2.1 The integrity rule, enforced by construction and by harness

The registry for session D is built from data through **D−1 close only**. The banned optimization (build once over full history, filter by formation date) is not implemented anywhere. The permitted incremental forward engine is used for speed — and it is only permitted because the **equivalence harness** exists as a required test: for sampled (symbol, day) pairs, a from-scratch rebuild over a **physically truncated** series must produce a byte-identical registry (sessions, family store, lineage events, and internal counters — the full state, compared as canonical JSON). `tests/09-equivalence.test.js` runs this on AAPL and TSLA fixture data; `tests/08-availability.test.js` re-derives sampled days for AAPL/KO/COIN. If incremental and truncated ever disagree, **the truncated rebuild is correct by definition**.

Prefix-safety is engineered, not hoped for: every precomputed structure in `lib/level-series.js` (adjusted OHLC, cumulative Σtp·w for AVWAP, left-to-right Wilder ATR, fractal flags, range-extreme sparse tables) answers queries for "first N bars" using only bars 0..N−1.

### 2.2 Level sources (parent §5.1) — per registry day

- **structural** — fractal swing pivots (k=3 each side, strict comparison), trailing 120 sessions, clustered within 0.5% at the volume-weighted centroid, `touchCount` per cluster.
- **participation** — AVWAP from the most recent **significant** swing high and low; significance (≥5% move) is evaluated only on data available through the evaluation date (binary-search over running extremes gives the exact first-observable session for `firstKnownDate`).
- **calendar** — classical daily pivots (PP/S1/S2/R1/R2 from D−1) + weekly pivots from the prior completed (Monday-keyed) week.
- **psychological** — OFF (config flag, unchanged).
- All level math runs on the **adjusted daily basis** (A1 one-basis rule) — without this, NVDA's 2024-06 10:1 split would teleport every level −90% and shred lineage.

### 2.3 Availability (parent §5.3)

Every method level carries `formationDate ≤ firstKnownDate ≤ firstTradableDate`. Fractal: firstKnown = formation + k sessions. AVWAP: firstKnown = max(fractal confirmation, first session the ≥5% move was observable). Calendar: the session it applies to (see S3-C7). `firstTradableDate = firstKnownDate + 1 session` for close-discovered sources. Composites (clusters, confluence snapshots) take the max over members — conservative, never early.

### 2.4 Confluence (parent §5.1)

Snapshots group aligned levels (within 0.5%, ascending-price greedy chaining); tier counts **families, not methods** (F1/F2/F3+); the exact `methods[]` combination is stored on every snapshot; identical math never double-counts (verified by construction in `tests/15`).

### 2.5 Lineage (parent §5.4) — `levelSnapshotId` + `levelFamilyId`

Deterministic engine (`lib/lineage.js`): ascending-price matching within max(0.5%, 0.25 ATR), nearest anchor wins, elder breaks ties, side ignored; family anchor = EMA(α=0.15) of matched centroids; merge at 0.4%×5 consecutive sessions with elder survival, `mergedFrom`/`mergedInto`, and state transfer; split at >1.5%×5 with elder id retention + `splitFrom`; retirement at 20 zero-support sessions (reformation = NEW family); append-only role log with the four role states. Ids are zero-padded founding ordinals (`AAPL_fam0001`), so identical inputs give identical histories.

### 2.6 Registry artifact — `data/levels/{symbol}.json` (gitignored)

Per-session snapshot registry (`sessions[]`: date, ATR, D−1 close, snapshots with zones + familyId — exactly what Session 7's chart packets need) plus the family store (anchors, lineage cross-references, role logs, match histories) and the event list. `touchHistory`/`sequenceIndex` fields exist as empty S4 hooks and ride the merge-transfer path already.

---

## 3. Phase A test suite — the required eight, mapped to files

| # (S3 §3.7) | Test | File | Status |
|---|---|---|---|
| 1 | Availability assertion + re-derivation on sampled fixture (symbol, day) pairs | `tests/08-availability.test.js` (AAPL, KO, COIN × 4 sampled days) | ✅ 3 tests |
| 2 | Equivalence harness: incremental ≡ truncated (full state) | `tests/09-equivalence.test.js` (AAPL, TSLA × 3 sampled days) | ✅ 2 tests |
| 3 | Fractal availability: absent until D+k, exact triple | `tests/10-fractal-availability.test.js` (synthetic) | ✅ 1 test |
| 4 | AVWAP significance availability: confirmed ≠ significant | `tests/11-avwap-availability.test.js` (synthetic) | ✅ 1 test |
| 5 | Lineage determinism: identical runs + arrival-order independence | `tests/12-lineage-determinism.test.js` | ✅ 2 tests |
| 6 | Five synthetic lineage scenarios (drift / merge / split / retire+reform / role flip) | `tests/13-lineage-scenarios.test.js` (all five as constructed **price series** through the full pipeline) | ✅ 5 tests |
| 7 | No-orphan invariant (snapshot↔family closure, match-history closure) | `tests/14-no-orphan.test.js` (KO fixture) | ✅ 1 test |
| 8 | Cluster hygiene: identical-math rejection; family-vs-method counting | `tests/15-cluster-hygiene.test.js` (constructed cases) | ✅ 2 tests |

**Phase A tally: 17/17 green.** Suite wall-clock ≈ 1.5 s.

Scenario construction notes (why these series work): merge uses a high-plateau bias exclusive to `avwap_high`'s window converging onto a younger `avwap_low` during a long consolidation; split uses fat ranges (ATR ≈ 5% of price → match radius ≈ 1.25%) so one family holds both AVWAP levels while a slow drift pulls the young-window AVWAP > 1.5% away for 5 consecutive sessions. Scenarios isolate one source family through the builder's explicit test hook (`enabledFamilies`) — the lineage code path is always production code.

## 4. Full-suite tally in THIS environment (and what the founder should expect locally)

| Suite | Here (no `data/`) | Expected locally (after fetch) |
|---|---|---|
| S2 fixture-based (hourly/DST, review-fix regressions) | ✅ 10/10 | ✅ 10/10 |
| S2 data-dependent (cross-grain, warmup, auction, depth, adjustment) | 🔴 44 fail — `Missing data/normalized/... run npm run fetch` (expected: Phase B data absent) | ✅ 44/44 (they were 54/54 green at S2 close; nothing they consume changed — normalize/fetch code untouched, config patch additive) |
| **S3 Phase A (new)** | ✅ **17/17** | ✅ 17/17 |
| **Total** | **27 pass / 44 data-blocked of 71** | **71/71** |

Operational fix included: the `npm test` script now uses the quoted-glob form (`node --test "tests/*.test.js"`) — the bare-directory form failed to resolve under this environment's Node 22.22.2; the glob form works on both. `npm run levels` was added for Phase B.

## 5. Phase B — SKIPPED here; exact founder instructions

Phase B needs the S2 disk cache (`research/level-study/data/`), which lives only on the founder's machine. To run:

```bash
cd research/level-study
# 1. PLTR and BE are in the frozen universe but were NOT in the S2 probe fetch:
node 01-fetch-history.js PLTR BE
# 2. Build all level registries (frozen-universe scope, 11 study symbols):
npm run levels
```

The runner writes `data/levels/{symbol}.json` + `data/levels/_stats.json` (both gitignored) and prints, per symbol: active levels/day (median/p90/max), family count + live/retired/merged, median family lifespan, merge/split/retirement/role-flip counts, tier mix (F1/F2/F3 share), runtime — followed by an **anomaly scan** (≥10× median family count; zero merges anywhere; symbols that never retire a family). Anomalies are **findings for founder review, not knobs to tune** (S3 prompt §4.3); knob changes are a founder decision and a config-version conversation.

**Smoke context from committed fixtures (NOT Phase B):** the AAPL daily fixture (2023-07-10 → 2024-06-28 window, 246 registry sessions) produces: 18 active levels/day median (p90 23, max 26), 81 families (34 live / 41 retired / 6 merged), median lifespan 48 sessions, 6 merges, 0 splits, 41 retirements, 283 role flips, tier mix F1/F2/F3 ≈ 73.5/23.6/2.9%, ~100 ms/symbol-year. Two early observations the founder should expect to see again in Phase B, flagged now: **(i)** role-flip counts run high because calendar-pivot families sit near price and flip sides often; **(ii)** splits are rare at real-market ATR (the >1.5%-within-family geometry needs high volatility) — both are behaviors of the spec'd knobs, reported as findings, not tuned.

## 6. Founder decision requested — S3-C7 (calendar tradability)

Parent §5.3 sets calendar `firstKnownDate` = "the session they apply to" while the general rule says `firstTradableDate = firstKnownDate + 1`. Read literally together, a daily pivot for session D becomes tradable on D+1 — a session it no longer exists for (D+1 has its own pivots from D's bar). That would categorically exclude the calendar family from event referencing, contradicting its status as a first-class confluence family. **Implemented:** calendar levels are tradable the session they apply to (they derive wholly from prior completed bars, so the "+1 = known at prior close" purpose is already satisfied). Flip-back is one config line (`levels.construction.calendarTradableSameSession`) + rebuild if the literal reading was intended. Full rationale: rulings doc §B, S3-C7. All other S3 choices (S3-C1…C16) are conventions with sub-threshold risk, each ⚠-flagged in `config.js` and documented.

## 6b. Mandatory code review (BUILD_RULES §2: ≥10 files / ≥1500 lines) — run and applied

An 8-angle finder pass (line-by-line, removed-behavior, cross-file trace, reuse, simplification, efficiency, altitude, conventions) with adversarial verification was run over the full change set. Outcomes:

**Confirmed and FIXED (follow-up commit):**
1. `runTruncated`/`finalDay` with an empty truncated prefix silently built a garbage NaN registry day instead of throwing (two finders reproduced it). Uniform validation added — a registry day now always requires ≥1 prior bar and must respect `startDate`.
2. Split-counter/execution mismatch: the 5-session counter could accumulate on un-partitionable single-snapshot sessions and then a one-day transient fired a permanent split (empirically reproduced). S3-C14 hardened: counting and execution now use the same ≥2-snapshot + >1.5% condition (rulings doc updated).
3. A daily bar lacking a usable adjustment basis (`adjFactor`/`adjusted_close` null) silently fell back to raw prices, mixing bases within one series (phantom fractal / ATR shock near splits). Now throws — quarantine-until-explained per parent §4.3. All committed fixtures verified clean.
4. `calendarTradableSameSession` was documented as the S3-C7 remediation switch but no code read it. The flag is now live: flipping it genuinely produces the literal `+1` behavior (calendar daily pivots drop out of their own session's registry; weekly pivots tradable from the week's second session).
5. familyId ordinals padded 4→6 digits (elder tie-breaks depend on lexicographic == founding order; 4 digits inverted elder semantics past 9,999 families).
6. Degraded-checkout fallback scope narrowed to probe **equities** (context symbols host no levels — design of record over the prompt's "14-symbol" shorthand; the path is practically unreachable since the universe file is committed) and its false "sectorMap stays pending" message removed; missing-data skip message now names the exact per-symbol fetch command; `universeFilePath` is now read from config (single source of truth); anomaly-scan median now uses the same `quantile()` as the reported stats; plus dead-code cleanup (unreachable tie-break clause, dead guard, unused exports/helper, sparse-table row sizing).

**Confirmed as behavior — REPORTED, not fixed (no spec knob; founder decision territory):**
- **Role-flip churn + role/zone frame:** roles derive from the nearest snapshot's side vs D−1 close with no hysteresis (spec defines none), so at-the-money families flip often (283 flips / 246 AAPL fixture sessions); separately, S4 episode zones are ANCHOR-based while roles are snapshot-based, and the EMA-lagged anchor can sit on the other side of price on gap days. S4 must pick the role/zone frame; adding a hysteresis knob now would be knob-invention.
- **F4 enforcement gap in the S2 fetcher:** `01-fetch-history.js` would still fetch SPHB/SPLV 5m on a re-run (data is disk-cached, so no fetch happens until someone re-runs it), and its default list doesn't cover PLTR/BE. Config now records the ruling; enforcing it in the fetcher touches S2 code and two S2 test loops (which currently reference SPHB/SPLV sessions), so it is flagged for founder direction rather than silently changed. Until then: fetch PLTR/BE explicitly (§5) and don't re-run the probe fetch expecting F4 filtering.
- **Efficiency notes (accepted cost at current scale):** per-snapshot rebuild of the live-family list in `lineageStep`, worst-case O(N²) significant-swing scan, per-call `weekMonday` Date construction — all measured harmless at daily grain (~0.4 s/symbol full window); provably-safe memoizations documented in the review record if scale ever demands them.

**Refuted (with evidence):** config-version-reuse claim (explicit founder ruling "still version 1"; the S2 manifest embeds none of the changed values); sectorMap-references-unfetched-ETFs claim (verbatim founder-frozen transcription; staging documented inside the universe file itself; no current consumer).

**Post-fix verification:** full suite re-run — all 17 Phase A tests and all 10 runnable S2 tests still green; equivalence harness still exact.

## 7. Isolation & discipline confirmations

- Writes confined to `research/level-study/` and `docs/` — no product file touched, no fenced file read or edited, zero `src/`/`api/` imports.
- No network calls; no credentials read, printed, or committed.
- Artifacts (`data/levels/`) verified gitignored (`.gitignore:83`); only code/tests/config/docs committed.
- No event detection, episode logic, features, or outcome code (Session 4+).
- No knob was tuned against data: fixture observations above are reported findings; every constant the builder uses comes from the frozen config.

## 8. Next session gate

Session 4 (event detection) inherits this registry **after** founder review of: (1) the Phase B sanity stats from the local run, (2) the S3-C7 ruling, (3) adversarial review of the lineage diff (per the session prompt's HARD STOP).

*LevelStory Session 3 — 2026-07-12.*
