# LEVELSTORY — CONFIG TRACEABILITY TABLE

**Purpose:** every value in `research/level-study/config.js` mapped to its source section, so the founder can review the frozen config against the specs in one pass. Mandatory deliverable (S2 prompt §3).

**Source precedence:** `docs/LEVELSTORY_RULINGS_AND_AMENDMENTS_S2.md` (R1–R3, A1–A3) → `docs/LEVEL_STUDY_SPEC_V1_1_ADDENDUM_A_CONTEXT_LAYER_V1_1.md` (Addendum §A*) → `docs/LEVEL_INTERACTION_EVENT_STUDY_SPEC_V1_1.md` (parent §*). "S1 §" = `docs/discovery/SESSION1_DATA_DISCOVERY_REPORT.md`.

**Config version:** `STUDY_CONFIG_VERSION = 1`.

---

## ⚠ Ambiguity register — READ FIRST (founder decisions requested)

These are the only values where the specs were silent or ambiguous and Session 2 made a CHOICE. Each is greppable in `config.js` as `⚠ CHOICE:`. Nothing else in the config was invented — every other value is a literal transcription. None of these choices affects a fetch/normalize behavior this session validated **except** `dailyFetchStart` and `pacingMs`/`retry` (used by the fetcher) and the closing-auction/hourly/session knobs (used by the normalizer, and all directly spec-cited, so not flagged).

| # | Config path | Value chosen | Why it was a choice | Basis for the choice | Risk if wrong |
|---|---|---|---|---|---|
| 1 | `range.holdoutStart` | `2025-12-10` | R1 says "final ~7 months" — a duration, not a date | parent §13 states "29 in-sample months"; `2023-07-10` + 29 months = `2025-12-10`, leaving the final ~7 months as holdout. Internally consistent. | Low. Not used this session (no holdout logic built). Founder can move the boundary; one-line config edit. |
| 2 | `fetch.dailyFetchStart` | `2018-01-01` | §A6/R1 require "≥550 sessions before study start **with margin**" — margin size unspecified | Matches the S1 daily fixtures exactly (2018-01-01 → 2026-07-10) and yields ~1,387 pre-study sessions for mature names (S1 §4), ~837 margin. Newer names return from listing regardless. | None. More warmup is free (daily is one whole call/symbol). Depth-eligibility utility grades each symbol against the 550 floor independently. |
| 3 | `fetch.pacingMs` | `300` | Parent §4.5 + S2 prompt say "gentle pacing" — no number | Budget has 156× headroom (S1 §9); 300 ms between calls is conservative, not tuned. | None. Only affects wall-clock of the fetch. |
| 4 | `fetch.retry` | `maxAttempts 4, baseBackoff 800ms, ×2, on [429,500,502,503,504]` | S2 prompt says "retry-with-backoff on transient failures" — no numbers | Standard exponential backoff; retries only transient HTTP statuses (never 4xx client errors like the 422 span guard). | None material. |
| 5 | `levels.sourceFamilies.psychological.increments` | `null` | Parent §5.1 says "$5/$10 increments scaled by price band" but gives no band→increment map | Left null rather than invent a mapping. `INCLUDE_ROUND_LEVELS` is default OFF (parent §5.1), so unused in V1.1. | None in V1.1 (feature off). Pin before enabling. |
| 6 | `features.fingerprint.todBucketEtCutoffs` | `null` | Parent §8.2 names buckets `open/midday/power` but gives no ET minute cutoffs | Left null rather than invent cutoffs. Not needed until Session 5 (features). | None this session. Pin in Session 5. |
| 7 | `hourlyClass.evaluationOrder` | `[SHARP_REJECT, DRIFT_HOLD, BREAK_HOLD, BREAK_RECLAIM, CHOP]` | Parent §7 lists classes as a table; the rules are mutually exclusive by construction, but a residual (`CHOP = else`) implies an order | Table order; `CHOP` is the explicit residual. The P/C/W thresholds are disjoint, so order does not change any classification — recorded for determinism only. | None (rules are disjoint). |

**Not flagged (deliberately):** `corporateActionAdjacentSessions: 2` (parent §3.4 states "±2 sessions" explicitly), `sampleBudget.symbols: 175` (parent §13 states it), all P/C/W thresholds, all ATR multipliers, all lineage knobs — these are verbatim from the specs.

---

## 1. Range — `range` (R1; parent §4.2, §13)

| Path | Value | Source |
|---|---|---|
| `range.studyStart` | `2023-07-10` | R1 |
| `range.studyEnd` | `2026-07-10` | R1 |
| `range.holdoutStart` | `2025-12-10` | ⚠#1 — derived from R1 + parent §13 |
| `range.inSampleMonths` | `29` | parent §13 |
| `range.holdoutMonths` | `7` | R1 / parent §4.2 |
| `range.warmupMinSessions` | `550` | R1 / Addendum §A6 |

## 2. Universe & eligibility — `universe` (R2, R3; parent §4.2, §12; Addendum §A2.2, §A3.2, §A8)

| Path | Value | Source |
|---|---|---|
| `universe.eligibilityMinPreStudySessions` | `550` | R2 |
| `universe.eligibilityAsOf` | `2023-07-10` | R2 |
| `universe.targetSize` | `{min:150, max:200}` | parent §4.2 |
| `universe.strata` | `[mega_cap_tech, low_volatility, high_beta, gap_prone]` | parent §4.2 / §12 |
| `universe.universeFilePath` | placeholder | R2 (founder deliverable, pending) |
| `universe.probe.equities` | `[AAPL,NVDA,MSFT,KO,PG,JNJ,TSLA,AMD,COIN]` | S2 §4 |
| `universe.probe.context` | `[SPY,XLK,XLE,SPHB,SPLV]` | S2 §4 |
| `universe.sectorEtfs` | 11 SPDRs | Addendum §A2.2 |
| `universe.contextEtfs` | `{market:SPY, highBeta:SPHB, lowBeta:SPLV}` | Addendum §A3.2, §A8 |
| `universe.sectorMap` | `{}` | ⚠#… (empty; awaits universe freeze, Addendum §A2.2) |

## 3. Fetch mechanics — `fetch` (A1; parent §4.1, §4.5; Addendum §A5.2, §A6, §A8; S1 §8, §9)

| Path | Value | Source |
|---|---|---|
| `fetch.envKeyName` | `VITE_EODHD_API_KEY` | S1 §0/§10 |
| `fetch.endpoints` | `/api/eod`, `/api/intraday`, `/api/calendar/earnings` | parent §4.1 / Addendum §A5.2 |
| `fetch.intradayInterval` | `5m` | parent §4.1 |
| `fetch.intradayMaxSpanDays` | `600` | S1 §9 (A7, API-enforced 422) |
| `fetch.dailyWholeResponse` | `true` | S1 §9 |
| `fetch.dailyFetchStart` | `2018-01-01` | ⚠#2 |
| `fetch.intradayFetchStart` / `End` | `2023-07-10` / `2026-07-10` | Addendum §A6 (no intraday warmup) / R1 |
| `fetch.earningsBulkSymbolList` | `true` | S1 §8 |
| `fetch.earningsTrailingMonths` | `24` | Addendum §A5.2 / S1 §8 |
| `fetch.pacingMs` | `300` | ⚠#3 |
| `fetch.retry` | backoff params | ⚠#4 |
| `fetch.cache.*` | disk layout + key | S2 §4 |
| `fetch.rateLimitPerMin` / `dailyCap` | `1200` / `100000` | S1 §9 / parent §4.5 |

## 4. Session & exchange time — `session` (parent §2, §3.5; S1 §4, §6; S2 §4 DST)

| Path | Value | Source |
|---|---|---|
| `session.exchangeTimeZone` | `America/New_York` | S2 §4 (DST-first) |
| `session.regularOnly` | `true` | parent §2, §3.5 |
| `session.extendedHours` | `false` | S1 §6 |
| `session.barLabeling` | `open` | S1 §4/§6 (A4) |
| `session.regularOpenEtMinutes` | `570` (09:30) | parent §2 |
| `session.regularCloseEtMinutes` | `960` (16:00) | parent §2 |
| `session.lastRegularBarOpenEtMinutes` | `955` (15:55) | S1 §4 |
| `session.barsPerRegularSession` | `78` | S1 §4 (78 regular + 1 auction = 79) |

## 5. Self-built hourly bars — `hourly` (parent §3.6, §4.4; A2)

| Path | Value | Source |
|---|---|---|
| `hourly.selfConstructed` | `true` | parent §4.4 |
| `hourly.anchorEtMinutes` | `570` | parent §3.6 |
| `hourly.bucketBoundariesEtMinutes` | `[570,630,690,750,810,870,930,960]` | parent §3.6 (9:30–10:30 … 15:30–16:00) |
| `hourly.bucketCount` | `7` | parent §3.6 |
| `hourly.excludeClosingAuction` | `true` | A2 |
| `hourly.carrySessionCloseSeparately` | `true` | A2 |

## 6. Closing-auction print — `closingAuction` (A2; S1 §5, §7)

| Path | Value | Source |
|---|---|---|
| `closingAuction.detection.etMinutes` | `960` (16:00 ET) | S1 §7 rule 1 (DST-resolved to ET) |
| `closingAuction.detection.volumeNull` | `true` | S1 §7 rule 2 |
| `closingAuction.detection.ohlcEqual` | `true` | S1 §7 rule 3 |
| `closingAuction.tag` | `closingAuction` | A2 |
| `closingAuction.excludeFromMath` | `[pattern,range,volume,excursion,hourly_aggregation]` | A2 |
| `closingAuction.useForSessionClose` | `true` | A2 |
| `closingAuction.useForCrossGrainInvariant` | `true` | A1 / A2 |

## 7. Adjustment basis — `adjustment` (A1; parent §4.3, §3.4; S1 §5)

| Path | Value | Source |
|---|---|---|
| `adjustment.fiveMinuteIsRawUnadjusted` | `true` | A1 / S1 §5 |
| `adjustment.dailyIsDual` | `true` | S1 §5 |
| `adjustment.factorFormula` | `dailyAdjustedClose / dailyCloseRaw` | A1 / S1 §5 |
| `adjustment.crossGrainInvariant.pairing` | raw daily close ↔ 5m auction print | A1 / S1 §5 |
| `adjustment.crossGrainInvariant.tolerancePct` | `0.1` | A1 / parent §4.3 |
| `adjustment.corporateActionAdjacentSessions` | `2` | parent §3.4 (±2 sessions) |

## 8. Level detection — `levels` (parent §5.1, §5.3, §5.4)

| Path | Value | Source |
|---|---|---|
| `levels.sourceFamilies.structural` | `fractalK 3, trailing 120, cluster 0.5%, vol-weighted centroid` | parent §5.1 |
| `levels.sourceFamilies.participation` | AVWAP from most recent significant swing | parent §5.1 |
| `levels.sourceFamilies.calendar` | daily PP/S1/S2/R1/R2 (D−1) + weekly (prior week) | parent §5.1 |
| `levels.sourceFamilies.psychological` | round numbers, flag `INCLUDE_ROUND_LEVELS`, OFF; `increments null` | parent §5.1 / ⚠#5 |
| `levels.sourceFamilies.moving` | reserved V2, OFF | parent §5.1 |
| `levels.confluence.alignPct` | `0.5` | parent §5.1 |
| `levels.confluence.tiers` | `F1=1, F2=2, F3plus=3` | parent §5.1 |
| `levels.significantSwingMovePct` | `5` | parent §5.3 |
| `levels.availability.firstTradableOffsetSessions` | `1` | parent §5.3 |
| `levels.availability.*firstKnown` | fractal/avwap/calendar rules | parent §5.3 |
| `levels.lineage.matchWithin` | `max(0.5%, 0.25 ATR)` | parent §5.4 |
| `levels.lineage.tieBreak` | nearest → elder | parent §5.4 |
| `levels.lineage.anchorEmaAlpha` | `0.15` | parent §5.4 |
| `levels.lineage.mergeWithinPct` / `mergeConsecutiveSessions` | `0.4` / `5` | parent §5.4 |
| `levels.lineage.splitSeparationPct` / `splitConsecutiveSessions` | `1.5` / `5` | parent §5.4 |
| `levels.lineage.retireZeroSupportSessions` | `20` | parent §5.4 |
| `levels.lineage.roleStates` | 4 states | parent §5.4 |

## 9. Episode / event detection — `episode` (parent §6.1, §6.2)

| Path | Value | Source |
|---|---|---|
| `episode.zoneAtrMult` | `0.25` | parent §6.1 |
| `episode.atr` | `{period:14, grain:daily, asOf:D-1}` | parent §6.1 |
| `episode.closeSeparationAtr` | `1.0` | parent §6.1 |
| `episode.closeMinSessionsOutside` | `1` | parent §6.1 |
| `episode.freshApproachRequired` / `timeOnlyRearm` | `true` / `false` | parent §6.1 |
| `episode.gapThroughDisposition` | `GAP_BREAK` | parent §6.1 |
| `episode.crossLevelDedup.intersectAtr` | `0.5` | parent §6.2 |
| `episode.crossLevelDedup.assignOrder` | tier → nearest → elder | parent §6.2 |

## 10. Hourly confirmation taxonomy — `hourlyClass` (parent §7)

| Path | Value | Source |
|---|---|---|
| `hourlyClass.units` | `daily_ATR` | parent §7 |
| `hourlyClass.classes.SHARP_REJECT` | `P≤0.35, C≥0.25, W≥0.30` | parent §7 |
| `hourlyClass.classes.DRIFT_HOLD` | `P≤0.35, 0≤C<0.25` | parent §7 |
| `hourlyClass.classes.BREAK_HOLD` | `P>0.35, C≤−0.15` | parent §7 |
| `hourlyClass.classes.BREAK_RECLAIM` | `P>0.35, C≥0.10` | parent §7 |
| `hourlyClass.classes.CHOP` | else | parent §7 |
| `hourlyClass.evaluationOrder` | table order | ⚠#7 (disjoint rules; order immaterial) |
| `hourlyClass.rvolOverlay` | hourly, hour-matched, 20-day baseline | parent §7 |

## 11. Features — `features` (parent §8.2–§8.4; Addendum §A2, §A3.2)

| Path | Value | Source |
|---|---|---|
| `features.availabilityClasses` | `[pre_touch, post_touch]` | parent §8.1 / Addendum rule 1 |
| `features.nullNeverZero` | `true` | parent §6.3 / Addendum rule 5 |
| `features.snapshotImmutable` | `true` | Addendum §A1 rule 3 |
| `features.fingerprint.*` | §8.2 fingerprint set | parent §8.2 |
| `features.fingerprint.gap_context.thresholdAtr` | `0.3` | parent §8.2 |
| `features.fingerprint.todBucketEtCutoffs` | `null` | ⚠#6 |
| `features.momentumQuality.keys` | §8.3 set; `openingRangeMinutes 30` | parent §8.3 |
| `features.higherTf.*` | 20/50 stack, 20/50w SMA, 52w, ATR pctile, 20d compression | parent §8.4 |
| `features.relativeMomentum.*` | 5/20/60d vs SPY & sector, 60d beta, direction tags | parent §8.4 |
| `features.group.*` | peer rates, RS, at-touch direction | Addendum §A2.1–§A2.3 |
| `features.group.minEligiblePeers` | `5` | Addendum §A2.1 |
| `features.group.*.freshExtremeDays` | `63` | Addendum §A2.1 |
| `features.market.breadth.*` | 20/50 dma, nh-nl 63d, SPHB−SPLV 20d, vol pctile 20d/2yr | Addendum §A3.2 |

## 12. Regime & breadth — `regime` (Addendum §A3.1, §A6)

| Path | Value | Source |
|---|---|---|
| `regime.momoSpread` | `rankAt T-21, 60d return vs SPY, decile 0.1, window 20` | Addendum §A3.1 |
| `regime.sectorNeutralDrivesState` | `true` | Addendum §A3.1 |
| `regime.states.MOMO_ON` | `spread≥+2.0% AND 5-session slope≥0` | Addendum §A3.1 |
| `regime.states.MOMO_OFF` | `spread≤−2.0%` | Addendum §A3.1 |
| `regime.warmupSpinupSessions` | `81` | Addendum §A3.1 / §A6 |

## 13. Trend / extension — `trend` (Addendum §A4.1, §A4.2)

| Path | Value | Source |
|---|---|---|
| `trend.primaryOrigin` | `252 sessions, ≥4 ATR advance` | Addendum §A4.1 |
| `trend.currentLegOrigin.swingFractalK` | `3` | Addendum §A4.1 |
| `trend.currentLegOrigin.minAdvanceAtr` | `3.0` | Addendum §A4.1 |
| `trend.currentLegOrigin.deepPullbackResetPct` | `50` | Addendum §A4.1 |
| `trend.currentLegOrigin.sidewaysResetSessions` / `BandAtr` | `30` / `2.5` | Addendum §A4.1 |
| `trend.baseCount` | `≥10 sessions, 2.5 ATR band, after ≥3 ATR leg, from current_leg_origin` | Addendum §A4.1 |
| `trend.extension.formula` | sign-normalized `(close−50DMA)/ATR` per side | Addendum §A4.2 |
| `trend.extension.pctileTrailingSessions` / `MinSessions` | `504` / `252` | Addendum §A4.2 |
| `trend.extension.buckets` | `NOT_EXT<50, MID 50–85, EXT>85` | Addendum §A4.2 |

## 14. Catalyst / earnings — `catalyst` (Addendum §A5.1, §A5.2; A3)

| Path | Value | Source |
|---|---|---|
| `catalyst.originClass.EARNINGS_GAP` | `gap≥1.0 ATR, ±1 session of known earnings, at/first-5 of leg origin` | Addendum §A5.1 |
| `catalyst.originClass.NON_EARNINGS_GAP` | same gap, no earnings ±1 session | Addendum §A5.1 |
| `catalyst.earnings.sessions_since_last_earnings` | `pre_touch` | Addendum §A5.2 |
| `catalyst.earnings.sessions_to_next_earnings_actual` | `post_touch, descriptive` | Addendum §A5.2 / A3 |
| `catalyst.earnings.sessions_to_expected_earnings` | `pre_touch proxy, median trailing gap, ≥2 prior` | Addendum §A5.2 |
| `catalyst.earnings.scheduledDatesAreNotHistoricallyKnown` | `true` | A3 |

## 15. Outcomes — `outcomes` (parent §9.1, §9.2, §9.3, §3.3)

| Path | Value | Source |
|---|---|---|
| `outcomes.origins` | `[touchAt, entryAt]` | parent §9.1 |
| `outcomes.horizons` | `[15m,30m,60m,120m,EOD,nextOpen,nextEOD]` | parent §9.1 |
| `outcomes.heldBeyondAtr` | `0.25` | parent §9.1 |
| `outcomes.timeToFavorableAtr` | `[0.25,0.50,0.75,1.00]` | parent §9.1 |
| `outcomes.targetBeforeStop` | targets `[0.50,0.75,1.00,1.50]` × stops `[0.25,0.50,0.75]` | parent §9.1 |
| `outcomes.drawdownBeforeTargetAtr` | `0.75` | parent §9.1 |
| `outcomes.resolutionStates` | `[held,broke,reclaimed_after_break]` | parent §9.1 |
| `outcomes.bridge.fractionElapsedNullBelowAtr` | `0.25` | parent §9.2 |
| `outcomes.ambiguity.rule` | `adverse_first` | parent §9.3 |
| `outcomes.ambiguity.escalationPctThreshold` / `escalateTo` | `10` / `1-min` | parent §9.3 |
| `outcomes.ambiguity.cleanBounce` | `MFE≥0.75 before MAE≥0.50` | parent §9.3 |
| `outcomes.entryAt.overnightCutoffEtMinutes` | `955` (15:55) | parent §3.3 |

## 16. Honesty gates & statistics — `honesty` (parent §10.3, §11, §15)

| Path | Value | Source |
|---|---|---|
| `honesty.floors.minNForPct` / `minNForMedian` | `5` / `3` | parent §10.3 |
| `honesty.bootstrap` | `date-clustered, 2000 iters, 90% CI` | parent §11.2 |
| `honesty.stabilityReview` | leave-one symbol/sector/5-session-episode out | parent §11.2 |
| `honesty.incrementalLift` | logistic, per question, appendix only | parent §11.3 |
| `honesty.holdout.singleOpen` | `true` | parent §11.4 |
| `honesty.holdout.graduationAllOf` | 4 rules | parent §11.4 |
| `honesty.holdout.verdicts` | `[CONFIRMED,UNCONFIRMED,DEAD]` | parent §11.4 |
| `honesty.acceptance.minN` | `30` | parent §15 |
| `honesty.acceptance.minSiblingDiffPoints` | `15` | parent §15 |
| `honesty.acceptance.confirmationTimeAsymmetry` | `MFE ≥ 2× MAE` | parent §15 |
| `honesty.footer` | 8 footer items | parent §10.3 |

## 17. Primary questions — `primaryQuestions` (parent §10.1; Addendum §A4.3)

| Path | Value | Source |
|---|---|---|
| `primaryQuestions.P1` | hourly_class → held_EOD (F2+), confirmation-time | parent §10.1 |
| `primaryQuestions.P2` | fractionElapsedAtEntry distribution + remaining MFE/MAE, bridge | parent §10.1 |
| `primaryQuestions.P3` | rvol_approach → clean_bounce (F2+), touch-time | parent §10.1 |
| `primaryQuestions.P4` | family tier → held_EOD within SHARP_REJECT | parent §10.1 |
| `primaryQuestions.P5` | BREAK_RECLAIM vs DRIFT_HOLD forward MFE | parent §10.1 |
| `primaryQuestions.P6` | EXT vs NOT_EXT → clean_bounce (F2+, SHARP_REJECT) | Addendum §A4.3 |
| `primaryQuestions.P6.sampleBudgetFallback` | interaction drops first | Addendum §A4.3 |
| `primaryQuestions.P6.legDetectionFallback` | 50DMA+ATR-only extension survives | Addendum §A4.1 |

## 18. Manual review, sample budget, report — `manualReview` / `sampleBudget` / `report`

| Path | Value | Source |
|---|---|---|
| `manualReview.sampleSize` | `100` | parent §12 |
| `manualReview.garbageGatePct` | `10` | parent §12 |
| `manualReview.componentGradingSlices` | event / leg_origin / base_count | Addendum §A4.1 |
| `manualReview.demoteBelowAgreementPct` | `80` | Addendum §A4.1 |
| `sampleBudget.*` | 175 × 29 × 1.5 ≈ 7,600; checkpoint n=30 | parent §13 |
| `report.viewsPerCohort` | `[pattern,context,comparative,validation]` | Addendum §A7 |

---

*Traceability table — LevelStory Session 2, Phase 0. Reviewed by the founder at the STOP before the full-universe fetch is greenlit.*
