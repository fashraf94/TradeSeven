# LEVELSTORY — SESSION 3.5 REWORK REPORT
## Lineage Rework (LS3-01 … LS3-10)

**Branch:** `claude/level-study-session3-levels-lineage-8v31gp` (continuing the S3 branch; started from `2d3a8830`, clean tree).
**Date:** 2026-07-12. **Config:** `STUDY_CONFIG_VERSION = 2`.
**Environment case (prompt §0.2):** `research/level-study/data/` is **absent** here — but the committed daily fixtures cover the FULL study window for the 9 probe equities, so the acceptance gate ran in-session at 9-symbol scope (all three volatility strata; gap_prone/PLTR/BE missing). The 11-symbol confirmation on real data is a founder step (§6). Pre-rework suite state here: 27 runnable green + 44 data-blocked, consistent with 71/71 locally.

---

## 1. Executive verdict table

| Item | Verdict |
|---|---|
| Fix 1 — unified distance scale + load-asserted ordering (LS3-01) | ✅ Built; `config.js:validateGeometry` (config.js:657) throws on violation; `tests/19` proves it |
| Fix 1b — bounded-diameter confluence dissolves LS3-08 | ✅ Theorem, not rule: `lib/level-sources.js:boundedGroups` (:77) + build-time span assert; S3's ≥2-snapshot split guard deleted; `tests/19` theorem test (>1000 snapshots, TSLA fixture) |
| Fix 2 — warmup lineage replay + checkpoint (LS3-02) | ✅ `02-build-levels.js` replay loop + `takeStudyStartCheckpoint` (:130); `preStudy`/`preStudyAgeSessions` on every family; `tests/18` (incl. an eldership case S3 would have inverted) |
| Fix 3 — merge effective timing + full operator (LS3-03/05) | ✅ Ownership rewritten in the D registry (`lib/lineage.js` merge phase; event suppression :275); operator table for EVERY field (config `lineage.merge.transfer`); `tests/17` + scenario b |
| Fix 4 — role state machine (LS3-04) | ✅ Anchor frame + 0.25u zone + 0.25u margin + 3 confirming D−1 closes; pending state + resets; `tests/17` role boundary + `tests/13` scenario e |
| Fix 5a — live support for runs (LS3-09) | ✅ Retire-vs-merge conflict impossible by construction; residual precedence table stated + compound-tested |
| Fix 5b — study-end enforcement (LS3-06) | ✅ Physical truncation at `studyEnd`, explicit `endDate` default, `actualFirst/LastSession` in artifacts, out-of-window throws |
| Fix 5c — anomaly scan rebuild (LS3-07) | ✅ Hard invariants THROW (`assertRegistryInvariants`, 02-build-levels.js:205); per-symbol + MAD + cross-strata warnings (`scanWarnings`, :340) — the scan now catches exactly what it missed (see §4: it flags the residual finding loudly) |
| Test hardening (LS3-10, §9 items 1–11) | ✅ All 11 delivered (map in §5) |
| **Suite** | ✅ **87 tests; 43/43 runnable green here; 44 data-blocked S2 tests unchanged (87/87 expected locally)** |
| **Acceptance gate (§8)** | ⚠️ **FAIL on the letter of the criterion — with the LS3-01 diagnosis itself CONFIRMED.** See §3; per §12 no knob was touched; STOP for founder decision |
| Branch pushed | ✅ (at STOP) |

---

## 2. What changed (claims cited to code/tests — per §12, every claim verifiable)

1. **Unified scale:** `u(D) = clamp(0.25·ATR14(D−1), 0.5%·p, 1.5%·p)` (`lib/level-sources.js:distanceUnit`, :40). Thresholds: cluster/confluence diameter ≤ 0.5u, merge ≤ 0.8u, match ≤ 1.0u, split > 1.6u (`config.js` `levels.geometry`). Ordering + `kConfluence < kMerge` (merge reachability under live support) asserted at load. Value reasoning: rulings doc §A amendment 2.
2. **Bounded-diameter grouping** replaces centroid-chaining for both pivot clustering and confluence (deterministic left-greedy on price-ascending items; span bound asserted at build time). Consequence: single-snapshot split-threshold breach is impossible (`kConfluence 0.5 < kSplit 1.6`); the S3-C14 guard is gone.
3. **Warmup replay:** lineage runs from the first ATR-defined session (index 14) through warmup into the study (one state machine; `02-build-levels.js` main loop). Checkpoint carries true bornDates/anchors/counters/roleLogs/pending state; warmup `matchHistory` cleared (S35-C4); stats aggregate study-window events only (`computeStats`).
4. **Merge is effective in the D registry:** same-session snapshot ownership rewrite + same-day absorbed role-event suppression (`lib/lineage.js:275`); `touchHistory` union-sorted; `sequenceIndex` recomputed from merged touchHistory; pending discarded absorbed-side; S4 hooks transfer contract implemented (currently empty fields). *(S3's report claimed touchHistory/sequenceIndex "ride the merge path already" — they did not; both operators now exist in code at the merge phase and are asserted in tests/13 scenario b and tests/17.)*
5. **Role machine:** evidence = D−1 close beyond `anchor ± (0.25u + 0.25u)` on the opposite side, 3 consecutive matched sessions, flip recorded on D (inputs strictly prior-close: pre-update anchor, refClose = close(D−1), u(D) from ATR(D−1)). Gray band resets (consecutive-evidence reading, documented).
6. **Study-end enforcement:** CLI physically truncates input at `studyEnd`; `runLevels` defaults `endDate` to `studyEnd` (never "whatever is cached"); artifacts stamp `configVersion: 2` + `window.actualFirst/LastSession`; out-of-window emission throws.
7. **Anomaly scan:** hard invariants (family-count identity; merged==merge-events; per-event coherence; ownership follows merge timing — the LS3-03 regression guard; no post-terminal matches) THROW. Warnings: per-symbol zero-event checks (per symbol, not global), MAD outliers (median-absolute-deviation, replacing the inert 10×-median rule), cross-strata ATR%↔rate correlations + volatility-tertile ratios + all-zero-stratum detection.

## 3. ACCEPTANCE GATE (§8) — verdict with pre/post numbers

Scope: 9 probe equities, committed fixtures, full window 2023-07-10 → 2026-07-09 (753 sessions). The pre-fix baseline was captured from the S3 engine (commit `2d3a8830`) **before any rework code was written**; it reproduces the founder's Phase B pathology (zero-merge high-beta names, zero-split low-vol names, flip rates matching 658–1,169/754).

| Sym | ATR% | merges pre→post | splits pre→post | F3% pre→post | flips/100 pre→post |
|---|---|---|---|---|---|
| AAPL | 2.0 | 14 → 13 | 0 → 0 | 2.6 → 0.7 | 6.44 → 2.62 |
| NVDA | 3.6 | 3 → 17 | 1 → 0 | 1.5 → 1.0 | 6.76 → 2.32 |
| MSFT | 1.9 | 11 → 12 | 0 → 0 | 3.3 → 1.0 | 6.40 → 2.38 |
| KO | 1.4 | 11 → 11 | 0 → 0 | 5.0 → 1.5 | 5.64 → 1.91 |
| PG | 1.4 | 10 → 10 | 0 → 0 | 6.9 → 1.9 | 7.02 → 2.21 |
| JNJ | 1.5 | 20 → 11 | 0 → 1 | 3.8 → 1.1 | 6.12 → 2.13 |
| TSLA | 4.3 | 0 → 12 | 6 → 0 | 1.3 → 1.0 | 7.37 → 2.34 |
| AMD | 4.2 | 0 → 16 | 3 → 0 | 1.0 → 0.8 | 6.41 → 2.29 |
| COIN | 6.5 | 0 → 14 | 27 → 0 | 0.4 → 0.5 | 6.45 → 2.22 |

Correlations (9 symbols): ATR%↔splits **+0.86 → −0.31**; ATR%↔merges **−0.84 → +0.59** (tertile merge ratio 1.31 ≈ flat); ATR%↔F3-share **−0.83 → −0.67**; levels/day↔splits **+0.66 → −0.16**; levels/day↔F3-share **−0.94 → −0.76**. Zero-merge symbols: {TSLA, AMD, COIN} → **{}**.

### Verdict: **FAIL on the letter of §8 — while the LS3-01 diagnosis itself is CONFIRMED.** No knob was touched (§12); STOP.

Decomposition, both readings stated:

- **CONFIRMED (the diagnosis):** every volatility-linked pathology the diagnosis predicted collapsed. The merge/split *bimodality* is gone (no symbol pairs zero-merges with split-storms); zero-merge names vanished; ATR%↔split-rate fell from +0.86 to noise (−0.31); F3 share flattened dramatically across strata (range 6.5 pts → 1.4 pts); the volatility-tertile merge ratio is ~1.3. Tier is no longer measurably confounded with stock identity on these metrics — the P4 threat the diagnosis named.
- **FAIL (the letter):** §8 requires "no stratum shows all-zero for an event type." Post-fix, **splits are near-zero everywhere** (8 of 9 symbols zero; JNJ = 1): mega_cap_tech and high_beta strata are all-zero — the rebuilt anomaly scan flags exactly this, loudly. Critically this is **uniform across volatility**, not the volatility-linked failure §8's FAIL clause diagnoses ("the mixed-scale diagnosis was wrong") — the pre-fix split storm on COIN (27) was an artifact of the old mixed scales, and the corrected geometry reveals that at `kSplit = 1.6·u` genuine 5-consecutive-session constituent separations are rare events (structurally: both member snapshots must sit near opposite edges of the match radius, sustained, while the EMA anchor stays centered — my synthetic construction needed engineered volume asymmetry to produce one).
- **What this is NOT:** a reason for me to lower `kSplit` until splits appear. That is the banned move. `kSplit = 1.6` was my proposed v2 starting value (⚠ S35-C2, provisional); whether near-zero split rates are the *correct* behavior of a well-scaled engine (splits SHOULD be rare and meaningful) or the multiple needs founder recalibration (e.g., toward 1.2–1.3·u, still > kMatch) **is a founder decision and a config-v3 conversation.**
- **Second residual for the same conversation:** the remaining F2/F3-share tilt (−0.67/−0.76) traces to the **floor binding for the entire low-vol stratum** — KO/PG/JNJ have 0.25·ATR ≈ 0.35% < the 0.5% floor, so their unit (and confluence bound) is floor-set rather than ATR-set, giving them relatively wider grouping than their volatility implies. Lowering `floorPct` would be the lever; again founder territory.

## 4. Post-fix role-flip rates and anomaly-scan output

Flip rates: **1.91–2.62 per 100 matched-family sessions** (median 2.29) — down ~3× from 5.64–7.37 pre-fix; absolute: 313–423 flips/753 sessions vs 657–1,166. Per S35-C6 these knobs stay provisional until the Session-7 manual review grades detected flips against hand-read reversals.

Anomaly scan (9-symbol fixture run): cross-strata `{atrPct_vs_mergeRate: +0.59, atrPct_vs_splitRate: −0.31, atrPct_vs_F2F3share: −0.73, tertileRatio_merges: 1.31, tertileRatio_splits: 0}`; warnings: 8× "ZERO splits", 2× "stratum … ALL symbols record zero splits" (the §3 finding), plus MAD outliers (AAPL/KO flip rate at tiny MAD; KO/PG F2+F3 share — the floor-binding signature). Hard invariants passed on all 9 symbols. Warnings reported; nothing retuned.

## 5. Test hardening map (LS3-10 — §9 items → tests)

| § | Requirement | Where |
|---|---|---|
| 9.1 | Full-string-hash sampling seeds | `tests/_synthetic.js:fnv1a`; used in 08/09; regression test in 09 proves AAPL/TSLA no longer collide |
| 9.2 | Exhaustive equivalence, every date, one short fixture | `tests/16` (KO fixture slice, every emitted session, full-state canonical equality) |
| 9.3 | Exact-count boundaries (merge 4→no/5→yes, miss-reset-restart-from-1; retire 19→no/20→yes) | `tests/17` |
| 9.4 | Merge-date ownership | `tests/17` + `tests/13` scenario b + `assertRegistryInvariants` |
| 9.5 | Compound events (retire+merge; split-then-merge; no co-fire) | `tests/17` |
| 9.6 | Truncated equivalence on EVERY synthetic scenario | `tests/13` — each scenario asserts it at its key event date |
| 9.7 | Warmup replay inheritance + no warmup leakage | `tests/18` (2 tests, incl. real-age eldership) |
| 9.8 | Ownership-aware no-orphan closure | `tests/14` (transfer-chain walking, merge-date rewrite allowance, terminal-date coherence) |
| 9.9 | Weekly pivots: Monday-holiday week + first-session tradability | `tests/19` (2 tests) |
| 9.10 | Config ordering invariants throw | `tests/19` (7 violation cases) |
| 9.11 | Bounded-diameter theorem | `tests/19` (TSLA fixture, >1000 snapshots) + build-time assert |

**Tally: 87 tests (S2's 54 + 33 study tests) — 43/43 runnable green in this environment; the 44 S2 data-dependent tests need the founder's local `data/` (they were green at S2 close; fetch/normalize code untouched this session).**

## 6. Founder-run steps (real data, 11 symbols)

```bash
cd research/level-study
node 01-fetch-history.js PLTR BE     # if not yet fetched
npm test                              # expect 87/87
npm run levels                        # v2 rebuild: prints stats + anomaly scan; artifacts stamp configVersion 2
```
Then compare the printed cross-strata correlations and zero-event warnings against §3's 9-symbol numbers (expected: same shape — merges everywhere, splits ~zero, F3 flattened). The two decisions this session leaves open: **(1) kSplit magnitude** (accept rare splits, or recalibrate within the ordering constraints — config v3), **(2) floorPct** (the 0.5% floor binds the whole low-vol stratum). Session 4 remains blocked until both are ruled.

## 7. Discipline confirmations

- No knob was tuned against the gate; the only geometry values ever set are the pre-registered v2 starting values proposed BEFORE the post-fix run (⚠-flagged provisional).
- No invariant loosened, no test weakened; the S3 test intent was preserved or strengthened in every rewrite.
- Writes confined to `research/level-study/` + `docs/`; zero product imports (unchanged); artifacts gitignored; no network.
- No event detection, episodes, features, or outcomes.

*LevelStory Session 3.5 — 2026-07-12.*
