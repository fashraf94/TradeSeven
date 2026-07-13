// research/level-study/config.js
//
// LevelStory — frozen study configuration. STUDY_CONFIG_VERSION = 1.
//
// This is a PURE DATA transcription of the research contract. No study logic, no
// computed knobs, no conditionals deriving values — every value is a literal drawn
// from a cited spec section. The only executable line is the immutability freeze at
// the bottom (`deepFreeze`), which computes nothing; it only prevents mutation so a
// downstream session can never silently retune a locked knob.
//
// Source precedence (Session-2 prompt §3; Session-3 prompt §2 adds the S3 rulings):
//   0. docs/LEVELSTORY_RULINGS_AND_AMENDMENTS_S3.md         (S3-R1…S3-R5, S3-C*)
//   1. docs/LEVELSTORY_RULINGS_AND_AMENDMENTS_S2.md         (R1–R3, A1–A3)
//   2. docs/LEVEL_STUDY_SPEC_V1_1_ADDENDUM_A_CONTEXT_LAYER_V1_1.md   (Addendum §A*)
//   3. docs/LEVEL_INTERACTION_EVENT_STUDY_SPEC_V1_1.md      (parent §*)
//
// Every value carries a `// <source>` comment. The companion traceability table
// (docs/LEVELSTORY_CONFIG_TRACEABILITY.md) maps each path → source and flags with ⚠
// every value where the specs were silent/ambiguous and a Session-2 CHOICE was made.
// ⚠ markers appear inline below with the token "CHOICE:" so they are greppable.
//
// Isolation: this module imports nothing. Product code never imports it. (Parent §2.)

// STUDY_CONFIG_VERSION history (parent header rule — increment on any post-build knob
// change, never reuse):
//   1 → S3 build (fixed-percent geometry).
//   2 → S3.5 rework: unified distance scale, warmup replay, merge timing, role machine.
//   3 → S3.5-b recalibration (founder-directed): distanceUnit floorPct/capPct set from
//       the measured 0.25×ATR% distribution so each clamp guard binds ≤10% of
//       symbol-sessions per symbol (see distanceUnit note, S35-C10). The distance unit
//       changes materially from the v2 gate → new version so artifact provenance stays
//       unambiguous (the S3.5 report's v2 gate numbers remain valid for [0.5, 1.5]).
//   4 → S5.6: universe v2 (11 → ~230 names), the 5-minute warmup (intradayWarmupSessions),
//       and the P3 `hasIntradayApproach` gate. PROVENANCE MARKER ONLY — no geometric or
//       statistical knob changes value (geometry, questions, floors, window, holdout are
//       all unchanged). The bump exists so pre-S5.6 and post-S5.6 artifacts can never be
//       silently confused. (S5_6 rulings §D.)
export const STUDY_CONFIG_VERSION = 4;

const CONFIG = {
  version: 4, // S5.6 universe v2 + 5m warmup — see STUDY_CONFIG_VERSION note above

  meta: {
    codename: 'LevelStory', // parent header
    parentSpec: 'docs/LEVEL_INTERACTION_EVENT_STUDY_SPEC_V1_1.md',
    addendumSpec: 'docs/LEVEL_STUDY_SPEC_V1_1_ADDENDUM_A_CONTEXT_LAYER_V1_1.md',
    rulingsDoc: 'docs/LEVELSTORY_RULINGS_AND_AMENDMENTS_S2.md',
    offProductCriticalPath: true, // parent §2 non-goals: zero TradeSeven integration
  },

  // ── Range (R1; parent §4.2) ────────────────────────────────────────────────
  range: {
    studyStart: '2023-07-10', // R1: 36-month window start
    studyEnd: '2026-07-10',   // R1: window end (anchor)
    // CHOICE: holdoutStart derived, not stated as a date. R1 says "final ~7 months";
    // parent §13 says "29 in-sample months". 2023-07-10 + 29 months = 2025-12-10, which
    // leaves exactly the final ~7 months as holdout. Locked here for the whole study.
    holdoutStart: '2025-12-10', // ⚠ CHOICE: derived from R1 "~7 months" + parent §13 "29 in-sample months"
    inSampleMonths: 29,  // parent §13
    holdoutMonths: 7,    // R1 / parent §4.2 ("last ~7 months (~20%)")
    warmupMinSessions: 550, // R1 / Addendum §A6: ≥550 trading sessions of daily before studyStart
  },

  // ── Universe & eligibility (R2, R3; parent §4.2; Addendum §A2.2, §A8) ───────
  universe: {
    eligibilityMinPreStudySessions: 550, // R2: ≥550 daily sessions before eligibilityAsOf
    eligibilityAsOf: '2023-07-10',        // R2: measured before study start
    targetSize: { min: 150, max: 200 },   // parent §4.2 (raised from V1's 75–125 per §13)
    strata: ['mega_cap_tech', 'low_volatility', 'high_beta', 'gap_prone'], // parent §4.2 / §12

    // Starter universe frozen 2026-07-11 (universeVersion 1) — supplied at the Session-3
    // gate as anticipated by R2. Path updated from the S2 placeholder to the actual file.
    universeFilePath: 'research/level-study/universe_frozen.json', // S3-R5: actual frozen file (was S2 placeholder)

    // Probe set for Session 2 (founder-frozen, S2 prompt §4). HOOD dropped per R2,
    // RKLB dropped per R3. Exactly these 14 are fetched this session.
    probe: {
      equities: ['AAPL', 'NVDA', 'MSFT', 'KO', 'PG', 'JNJ', 'TSLA', 'AMD', 'COIN'], // S2 §4
      context: ['SPY', 'XLK', 'XLE', 'SPHB', 'SPLV'], // S2 §4 (context ETFs)
    },

    // Sector ETFs (11 SPDRs) frozen WITH the universe (Addendum §A2.2). Full list
    // recorded for the contract; the probe only exercises XLK and XLE.
    sectorEtfs: ['XLC', 'XLY', 'XLP', 'XLE', 'XLF', 'XLV', 'XLI', 'XLB', 'XLRE', 'XLK', 'XLU'], // Addendum §A2.2 (11 SPDR sector ETFs)
    contextEtfs: { market: 'SPY', highBeta: 'SPHB', lowBeta: 'SPLV' }, // Addendum §A3.2, §A8
    // S3-R5: transcribed verbatim from research/level-study/universe_frozen.json
    // (universeVersion 1, frozen 2026-07-11). Pure data transcription, not a decision.
    // Closes the S2 "awaits founder universe freeze" flag.
    sectorMap: { // S3-R5 / Addendum §A2.2 (frozen with the universe)
      AAPL: 'XLK', NVDA: 'XLK', MSFT: 'XLK',
      KO: 'XLP', PG: 'XLP', JNJ: 'XLV',
      TSLA: 'XLY', AMD: 'XLK', COIN: 'XLF',
      PLTR: 'XLK', BE: 'XLI',
    },
    // S3-R4 (F4 ruling): SPHB/SPLV are DAILY-GRAIN ONLY. Their 5m is never fetched or
    // referenced; beta_appetite_20d is a daily feature.
    dailyGrainOnly: ['SPHB', 'SPLV'], // S3-R4
  },

  // ── Fetch mechanics (A1; parent §4.1, §4.5; Addendum §A6, §A8; A7 from S1) ──
  fetch: {
    provider: 'EODHD',
    envKeyName: 'VITE_EODHD_API_KEY', // S1 §0/§10: actual .env variable name (not literal EODHD_API_KEY)
    endpoints: {
      daily: '/api/eod',              // parent §4.1
      intraday: '/api/intraday',      // parent §4.1
      earnings: '/api/calendar/earnings', // Addendum §A5.2 / S1 §8
    },
    baseUrl: 'https://eodhd.com',     // S1 §0 smoke call
    exchangeSuffix: '.US',            // S1 §8 (code AAPL.US)
    intradayInterval: '5m',           // parent §4.1
    intradayMaxSpanDays: 600,         // S1 §9 A7: API-enforced max (HTTP 422 beyond)
    dailyWholeResponse: true,         // S1 §9: daily EOD returns whole in one call
    // CHOICE: daily fetch start. R1/§A6 require ≥550 sessions before studyStart "with
    // margin". 2018-01-01 matches the S1 daily fixtures and yields ~1,387 pre-study
    // sessions for mature names (S1 §4) — ~837 margin. Newer names (COIN) return from
    // their listing date regardless; the depth-eligibility utility grades each per R2.
    dailyFetchStart: '2018-01-01', // ⚠ CHOICE: satisfies §A6 "≥550 with margin"; matches S1 fixtures
    // The 5m STUDY window start. NOT the fetch start — see intradayWarmupSessions below.
    intradayFetchStart: '2023-07-10', // = range.studyStart: the first session events may be detected on
    // S5.6 §3 — THE 5-MINUTE WARMUP. The RVOL baseline needs 20 trailing sessions of 5-MINUTE
    // data (features-intraday.js RVOL_DAYS=20, guard at :52), but the 5m fetch used to begin
    // exactly at studyStart. The DAILY warmup existed (dailyFetchStart 2018); the 5m warmup was
    // never built — so events in the first 20 study sessions nulled RVOL at 72.6% (vs 30.6%
    // elsewhere), losing 189 events (2.2%) to a pure data artifact.
    //
    // The 5m fetch therefore starts 30 TRADING sessions before studyStart (margin over the 20
    // required). The actual date is DERIVED PER SYMBOL from that symbol's own daily calendar
    // (01-fetch-history.js:fiveMinWarmupStart) — never a hardcoded calendar date, because
    // "30 trading sessions" is a market-calendar fact, not a 44-day arithmetic guess.
    //
    // HARD RULES (asserted, not merely intended — S5.6 §3):
    //   - warmup5m bars feed RVOL/volume BASELINES ONLY.
    //   - NO event may be detected on a warmup5m session (events.js asserts; tests/30).
    //   - No outcome, and no feature other than the baselines, ever reads them. Enforced by
    //     construction: the study-window session list and the baseline session list are
    //     SEPARATE inputs (features.js), so a warmup bar is unreachable from any other path.
    intradayWarmupSessions: 30, // S5.6 §3: trading sessions of 5m warmup before studyStart
    intradayFetchEnd: '2026-07-10',   // R1 studyEnd
    earningsBulkSymbolList: true,     // S1 §8: endpoint accepts a symbols= list (1 bulk call)
    earningsTrailingMonths: 24,       // Addendum §A5.2 / S1 §8 (24-mo trailing for cadence proxy)
    // CHOICE: pacing/retry. Parent §4.5 + S2 prompt call for "gentle pacing" and
    // "retry-with-backoff"; no numbers are specified. Budget has 156× headroom (S1 §9),
    // so values are conservative, not tuned.
    pacingMs: 300,                    // ⚠ CHOICE: gentle inter-call delay (spec: "gentle pacing"; no number given)
    retry: { maxAttempts: 4, baseBackoffMs: 800, backoffFactor: 2, retryOnStatus: [429, 500, 502, 503, 504] }, // ⚠ CHOICE: backoff params (spec: "retry-with-backoff"; no numbers)
    cache: {
      rawLayout: 'data/raw/{symbol}/{grain}/{from}_{to}.json', // S2 §4: disk cache, never refetch
      normalizedLayout: 'data/normalized/{symbol}/{grain}.json',
      cacheKey: 'symbol+grain+chunk-range', // S2 §4
      manifestLayout: 'data/manifest_{ts}.json', // S2 §4 (copied to docs/discovery for commit)
    },
    rateLimitPerMin: 1200, // S1 §9: observed x-ratelimit-limit
    dailyCap: 100000,      // S1 §9 / parent §4.5: 100K/day cap
  },

  // ── Session & exchange time (parent §2, §3.5; DST-first per S2 prompt §4) ───
  session: {
    exchangeTimeZone: 'America/New_York', // S2 §4 DST warning: ALL session logic in exchange time, DST-aware
    regularOnly: true,                    // parent §2, §3.5: regular session only; pre/post dropped at ingest
    extendedHours: false,                 // S1 §6: default /api/intraday is regular-session only
    barLabeling: 'open',                  // S1 §4/§6 (A4): START-time (bar-open) convention
    regularOpenEtMinutes: 570,            // 09:30 ET (parent §2: 9:30–16:00 ET)
    regularCloseEtMinutes: 960,           // 16:00 ET
    lastRegularBarOpenEtMinutes: 955,     // 15:55 ET bar (covers 15:55–16:00); S1 §4: 78 regular bars
    fiveMinuteStepMinutes: 5,
    barsPerRegularSession: 78,            // S1 §4: 78 regular + 1 auction = 79 (FULL days only; see halfDay)
    // S3-R3: session end is derived PER-SESSION from the data, never hardcoded 16:00.
    halfDay: { // S3-R3 (founder ruling)
      sessionEndDerivedPerSession: true,  // the 16:00 constants above describe FULL days; never assumed per-session
      tagField: 'halfDay',                // half-days tagged halfDay: true (normalize's earlyClose is the S2 precursor tag)
      eodLabelBar: 'last_regular_bar_of_actual_session', // EOD labels use the last regular bar of the actual session
    },
  },

  // ── Self-built hourly bars (parent §3.6, §4.4) ─────────────────────────────
  hourly: {
    selfConstructed: true,       // parent §4.4: never trust vendor hourly alignment
    anchorEtMinutes: 570,        // parent §3.6: 9:30-anchored
    // 7 buckets: 09:30–10:30 … 14:30–15:30 (six 60-min) + 15:30–16:00 (final 30-min).
    // parent §3.6 example: "9:30–10:30 … 15:30–16:00".
    bucketBoundariesEtMinutes: [570, 630, 690, 750, 810, 870, 930, 960], // parent §3.6
    bucketCount: 7,
    excludeClosingAuction: true, // A2: auction bar excluded from aggregation
    carrySessionCloseSeparately: true, // A2: session-close carried separately for outcomes/invariant
  },

  // ── Closing-auction print (A2; S1 §5, §7) ──────────────────────────────────
  closingAuction: {
    // Deterministic identification (S1 §7): all three must hold.
    detection: {
      etMinutes: 960,      // 16:00 ET (S1 §7 rule 1: 20:00 UTC in EDT / 21:00 UTC in EST — resolved in ET)
      volumeNull: true,    // S1 §7 rule 2: volume === null (JSON null, not zero)
      ohlcEqual: true,     // S1 §7 rule 3: open === high === low === close
    },
    tag: 'closingAuction',                 // A2: tag, don't strip
    excludeFromMath: ['pattern', 'range', 'volume', 'excursion', 'hourly_aggregation'], // A2
    useForSessionClose: true,              // A2: session-close price for EOD outcome labels
    useForCrossGrainInvariant: true,       // A1/A2: the daily-close ↔ auction-print pairing
    // S3-R2 (F3 ruling): sessions missing the closing-auction print fall back to the last
    // regular 5m bar (typically 15:55 ET on full days) as session close.
    eodFallback: { // S3-R2
      rule: 'last_regular_5m_bar',          // fallback session-close source when no auction print
      tagField: 'eodSource',                // every session tagged with its EOD source
      tagValues: { auction: 'auction', fallback: 'fallback_1555' }, // S3-R2 tag vocabulary
      crossGrainInvariantExempt: true,      // fallback sessions EXPLICITLY EXEMPT from the invariant…
      tolerancePctNeverLoosened: true,      // …the 0.1% tolerance is NEVER loosened to accommodate them
      reportFooterItem: 'fallback_session_count', // standing report-footer item
    },
  },

  // ── Adjustment basis (A1; parent §4.3, §3.4) ───────────────────────────────
  adjustment: {
    fiveMinuteIsRawUnadjusted: true,       // A1 / S1 §5: 5m delivered raw (splits not back-adjusted)
    dailyIsDual: true,                     // S1 §5: daily has close (raw) + adjusted_close
    basis: 'daily-raw at point-in-time; client-side factor applied to 5m for cross-time comparability', // A1
    // Per-session factor f(S) = dailyAdjustedClose(S) / dailyCloseRaw(S). Applied to raw
    // 5m OHLC to place it on the daily adjusted basis (S1 §5).
    factorFormula: 'dailyAdjustedClose / dailyCloseRaw (per session)', // A1 / S1 §5
    crossGrainInvariant: {
      pairing: 'raw daily close vs 5m closing-auction print (same session)', // A1 / S1 §5
      tolerancePct: 0.1, // A1 / parent §4.3
    },
    corporateActionAdjacentSessions: 2, // parent §3.4: events within ±2 sessions of split/div ex-date flagged & excluded from primary agg
  },

  // ── Stage 1: Level detection (parent §5) ───────────────────────────────────
  levels: {
    sourceFamilies: { // parent §5.1
      structural: {
        methods: ['swing_sr_clusters'],
        fractalK: 3,             // parent §5.1: fractal pivots, k=3 bars each side
        trailingSessions: 120,   // parent §5.1
        // clusterPct (S3: fixed 0.5%) superseded by geometry.multiples.kCluster (S3.5 §3)
        centroid: 'volume_weighted', // parent §5.1
      },
      participation: {
        methods: ['avwap_high', 'avwap_low'], // parent §5.1: AVWAP from most recent significant swing
        anchor: 'most_recent_significant_swing', // parent §5.1
      },
      calendar: {
        methods: ['daily_pivots', 'weekly_pivots'], // parent §5.1
        dailyPivots: ['PP', 'S1', 'S2', 'R1', 'R2'], // parent §5.1: from D−1
        weeklyFrom: 'prior_completed_week',          // parent §5.1
      },
      psychological: {
        methods: ['round_numbers'],
        // CHOICE: "$5/$10 increments scaled by price band" (parent §5.1) does not specify
        // the band→increment mapping. Flag-gated OFF by default, so unused in V1.1.
        increments: null, // ⚠ CHOICE: exact price-band→increment map unspecified in parent §5.1
        flag: 'INCLUDE_ROUND_LEVELS',
        enabled: false,   // parent §5.1: default OFF
      },
      moving: { reservedForV2: true, enabled: false }, // parent §5.1: reserved V2, not in V1.1
    },
    confluence: { // parent §5.1
      // alignPct (S3: fixed 0.5%) superseded by geometry.multiples.kConfluence (S3.5 §3)
      tiers: { F1: 1, F2: 2, F3plus: 3 }, // F1=1 family, F2=2, F3=3+
      countBy: 'family',           // count families, not methods
      storeMethodCombination: true, // exact methods stored on every snapshot
    },

    // ── S3.5 §3 (LS3-01): UNIFIED DISTANCE SCALE ─────────────────────────────
    // One bounded per-symbol-per-day distance unit; every geometric threshold is an
    // ordered multiple of it. Supersedes ALL fixed-percent geometry in parent §5.1/§5.4
    // (S3.5 rulings doc, amendment 2). Ordering invariants are asserted at config load
    // (validateGeometry below) — a violating config throws, never runs.
    geometry: {
      distanceUnit: {
        // distanceUnit(symbol, D) = clamp(atrMultiple × ATR(14,daily,D−1),
        //                                 floorPct% × price(D−1), capPct% × price(D−1))
        atrMultiple: 0.25, // parent §5.4's 0.25-ATR arm — the scale's ATR anchor
        // ⚠ CHOICE S35-C10 (config v3 recalibration — founder-directed, data-measured):
        // floorPct/capPct DERIVED from the per-session 0.25×ATR% distribution so each
        // guard binds in ≤10% of symbol-sessions for EVERY symbol (else the guard, not
        // ATR, sets the scale). The v2 [0.5, 1.5] band bound the floor for 49–96% of the
        // low-vol names' sessions and the cap for 64% of COIN's — flattening geometry by
        // volatility. Measured on the 9 fixture equities (all 3 strata), study + full
        // history: min_s p10(0.25×ATR%) ≈ 0.27, max_s p90 ≈ 2.66. Values sit just past
        // those boundaries with margin (worst bind: floor 6.1% KO, cap 9.0% COIN).
        // Re-confirm on the full universe (PLTR/BE + expansion) — one-line measurement.
        floorPct: 0.26,    // ⚠ S35-C10: floor binds ≤10% ∀s; still catches the genuine low-ATR/degenerate tail
        capPct: 2.71,       // ⚠ S35-C10: cap is load-bearing — binds only COIN's wildest ~9% (extreme-ATR tail), never its normal regime
      },
      multiples: { // v2 starting values — ALL ⚠ provisional (S35-C2); ordering NOT negotiable
        kCluster: 0.5,    // structural pivot grouping DIAMETER bound  (≤ kConfluence)
        kConfluence: 0.5, // confluence grouping DIAMETER bound        (< kMatch, < kMerge)
        kMerge: 0.8,      // family-anchor merge distance              (< kMatch)
        kMatch: 1.0,      // family matching radius — the reference scale
        kSplit: 1.6,      // constituent-separation split threshold    (> kMatch)
      },
      // Load-asserted ordering (validateGeometry): kCluster ≤ kConfluence < kMatch;
      // kMerge < kMatch; kSplit > kMatch; PLUS kConfluence < kMerge — under the
      // live-support rule (S3.5 §7a) merge evidence requires two DISTINCT snapshots
      // (level gap > kConfluence·u) with anchors within kMerge·u; kMerge ≤ kConfluence
      // would make merges structurally unreachable.
      // Bounded-diameter theorem (dissolves LS3-08): a snapshot's span ≤ kConfluence·u
      // < kSplit·u, so a single snapshot can NEVER breach the split threshold.
    },
    significantSwingMovePct: 5, // parent §5.3: AVWAP anchor requires observably ≥5% move (point-in-time)
    availability: { // parent §5.3, tradability as amended by S3.5 (amendment 1)
      fields: ['formationDate', 'firstKnownDate', 'firstTradableDate'],
      // S3.5 amendment 1 (supersedes the universal firstKnownDate+1 formula, which was
      // the source of the S3-C7 contradiction): firstTradableDate is the first registry
      // session whose PRIOR-CLOSE INFORMATION SET contains every input required to
      // construct the dated level. Yields per source:
      tradability: {
        rule: 'prior_close_information_set',
        fractal: 'session after the confirmation close',
        avwap: 'session after both fractal confirmation and observable ≥5% significance',
        dailyPivot: 'the session it applies to',
        weeklyPivot: 'the first trading session of the new week',
      },
      fractalFirstKnown: 'formationBar + k sessions',       // parent §5.3
      avwapFirstKnown: 'swing confirmed as fractal AND move ≥5% on available data', // parent §5.3
      calendarFirstKnown: 'the session they apply to',      // parent §5.3
      referenceRule: 'firstTradableDate <= eventDate for every referenced level', // parent §3.10/§5.3
    },
    lineage: { // parent §5.4, as amended by S3.5 (rulings doc amendments 2–6)
      snapshotId: 'dated state (price, zone width, side, methods, tier, as-of)', // parent §5.4
      familyId: 'persistent market structure',                                   // parent §5.4
      // matchWithin/mergeWithinPct/splitSeparationPct (S3 fixed/hybrid scales) superseded
      // by geometry.multiples (S3.5 §3): match = kMatch·u, merge = kMerge·u, split = kSplit·u.
      matchOrder: 'ascending_price',            // parent §5.4
      tieBreak: ['nearest_anchor', 'elder_family'], // nearest wins, elder breaks ties
      matchIgnoresSide: true,                   // role can flip
      anchorEmaAlpha: 0.15,                     // family anchor = slow EMA (α=0.15) of matched centroids
      mergeConsecutiveSessions: 5,              // parent §5.4 (unchanged: a count, not a distance)
      splitConsecutiveSessions: 5,              // parent §5.4 (unchanged)
      retireZeroSupportSessions: 20,            // zero method support for 20 sessions retires
      roleStates: ['support', 'resistance', 'resistance_turned_support', 'support_turned_resistance'], // parent §5.4 append-only role log

      // S3.5 §7a (LS3-09 structural dissolution): merge/split runs only advance on
      // sessions where the family receives a matching snapshot — an unsupported family
      // can never complete a merge run, so retire-vs-merge conflicts are impossible.
      liveSupportRequiredForRuns: true, // S3.5 amendment 6

      // S3.5 §4 (LS3-02): warmup lineage replay — lineage is one continuous state
      // machine from the first session where the distance unit is defined, through the
      // warmup, into the study window. Warmup sessions build state only, are never
      // emitted; the study begins with a checkpoint of inherited, real family identity.
      warmupReplay: { // S3.5 amendment 3
        enabled: true,
        startRule: 'first_session_with_ATR14_at_prior_close', // ⚠ CHOICE S35-C3: the unit needs ATR(14,D−1); the structural trailing window fills as history accrues
        emitFrom: 'startDate (studyStart in production)',
        checkpointFields: ['bornDate', 'anchor', 'status', 'zeroSupportRun', 'splitRun', 'pending role state', 'roleLog', 'pairRuns'],
        matchHistoryClearedAtCheckpoint: true, // ⚠ CHOICE S35-C4: warmup match history is state-building only; study artifacts reference only study-window snapshots
        preStudyFields: ['preStudy', 'preStudyAgeSessions'],  // nothing left-censored silently
      },

      // S3.5 §5 (LS3-03/LS3-05): merge effective timing + full state-transfer operator.
      merge: { // S3.5 amendment 4
        effectiveTiming: 'detection_session', // a merge detected from D's information set applies to D: D's snapshot ownership rewritten absorbed→survivor; same-day role events on the absorbed id suppressed
        transfer: {
          touchHistory: 'union sorted by (timestamp, familyId, snapshotId)',
          sequenceIndex: 'recomputed as merged touchHistory length', // ⚠ CHOICE S35-C5: the only rule coherent under repeated merges
          matchHistory: 'union, absorbed entries tagged fromFamilyId, sorted (date, snapshotId)',
          roleLog: 'survivor-owned; absorbed log retained on absorbed record (append-only, never rewritten)',
          pendingRoleState: 'survivor-only; absorbed pending discarded (measured against a dead anchor)',
          anchor: 'survivor-only; absorbed anchor recorded in the merge event for audit',
          counters: 'fired pair-run reset; survivor other runs persist unchanged',
          s4Hooks: 'transfer absorbed → survivor where survivor empty; survivor wins conflicts (absorbed value recorded in merge event)', // contract specified now; Session 4 populates
        },
      },

      // S3.5 §6 (LS3-04): role state machine — anchor frame + hysteresis.
      roleMachine: { // S3.5 amendment 5
        frame: 'family_anchor', // unified with S4 episode zones (anchor-based) — roles and zones can never disagree on gap days
        zoneHalfWidthUnits: 0.25,              // zone = anchor ± 0.25·distanceUnit (reused as flip margin; no new constant)
        flipBeyondOppositeBoundaryUnits: 0.25, // flip evidence: close beyond the OPPOSITE zone boundary by ≥ 0.25·u
        confirmSessions: 3,                    // sustained ≥3 consecutive matched registry sessions
        inputs: 'prior committed anchor, D-1 adjusted close, D-1 distanceUnit', // flip recorded on D only after the third confirming close occurred on D−1 (using D's close would be lookahead)
        pendingFields: ['pendingSide', 'pendingRun', 'pendingStartDate'],
        resets: ['close back inside zone', 'close on current-role side', 'gray band (outside zone but short of the flip margin — consecutive-evidence reading)', 'no matching snapshot', 'split', 'retirement'],
        provisional: true, // ⚠ S35-C6: 3×0.25 is a policy default, not a proven optimum — graduates only via the Session-7 manual-review demotion path
      },
    },

    // ── Session-3 construction conventions (02-build-levels.js) ──────────────
    // Deterministic conventions the builder needs where the specs are silent. Each is a
    // Session-3 CHOICE (⚠, greppable), recorded in docs/LEVELSTORY_RULINGS_AND_AMENDMENTS_S3.md
    // §B and the traceability table. Pure data — the builder reads these, never derives them.
    construction: {
      priceBasis: 'adjusted', // A1 one-basis rule: levels live on the daily adjusted basis (raw OHLC × adjFactor)
      volumeBasis: 'raw_divided_by_adjFactor', // ⚠ CHOICE S3-C1: VWAP/centroid weights use V/f so split-era share counts are comparable (A1 extension)
      typicalPrice: 'hlc3', // ⚠ CHOICE S3-C2: AVWAP price input = (H+L+C)/3 (standard anchored-VWAP convention)
      fractalComparison: 'strict', // ⚠ CHOICE S3-C3: swing high requires STRICTLY greater highs than all k bars each side (ties → no fractal)
      structuralClusterJoin: 'ascending_price_bounded_diameter_kCluster_units', // S35-C7 (supersedes S3-C4 centroid-chaining): left-greedy groups whose TOTAL SPAN never exceeds kCluster·u; volume-weighted centroid per group
      confluenceJoin: 'ascending_price_bounded_diameter_kConfluence_units', // S35-C8 (supersedes S3-C5): same rule, unweighted mean centroid; span bound is asserted at build time (bounded-diameter theorem, LS3-08)
      compositeAvailability: 'max_of_members', // ⚠ CHOICE S3-C6: cluster/snapshot formation/firstKnown/firstTradable = latest member's (conservative, never early); age features must use MEMBER triples or family bornDate
      // calendarTradableSameSession (S3-C7 flag) RETIRED — the S3.5 tradability amendment
      // (availability.tradability above) resolves the contradiction at the definition level.
      sideRule: 'centroid_lte_prior_close_is_support', // ⚠ CHOICE S3-C8: snapshot side vs D−1 adjusted close; exact tie → support (registry data + founding role only — session roles are the roleMachine's)
      familyObservedCentroid: 'unweighted_mean_of_matched_snapshot_centroids', // ⚠ CHOICE S3-C10: the anchor-EMA input when >1 snapshot matches
      familyMatchableSameSessionAsFounded: true, // ⚠ CHOICE S3-C11: a family founded earlier in the ascending pass is a match candidate for later snapshots
      // roleSideSource (S3-C12) RETIRED — superseded by lineage.roleMachine (anchor frame).
      splitExecution: 'nearest_snapshot_keeps_elder_id_each_other_branches', // ⚠ CHOICE S3-C13: at trigger, nearest-to-anchor snapshot stays; every other matched snapshot founds a branch with splitFrom
      // splitRequiresMultipleSnapshots (S3-C14) RETIRED — a theorem now, not a rule: the
      // bounded-diameter confluence bound (kConfluence < kSplit) makes a single-snapshot
      // split-threshold breach impossible by construction.
      // mergeStateTransfer (S3-C15) superseded by lineage.merge.transfer (full operator table).
      weeklyPivotWeek: 'iso_monday_keyed_prior_completed_week', // ⚠ CHOICE S3-C16: prior completed week = latest Monday-keyed week strictly before the session's week, aggregated H/L/last-C
      distanceMeasure: 'absolute_price_distance_vs_units', // S35-C9 (supersedes S3-C9 midpoint %): all geometric comparisons are |Δprice| vs multiples of the session's distanceUnit
    },
  },

  // ── Stage 2: Event detection / episodes (parent §6) ────────────────────────
  // GEOMETRY UNIT (S4.1 correction): the Addendum §6.1/§6.2 thresholds are specified in ATR, but
  // the distanceUnit u = clamp(0.25·ATR, floor, cap) ≈ 0.25·ATR (unclamped). Episode thresholds are
  // stored here as multiples of u (key suffix `U`), NOT of ATR. S4's `*Atr` names read the ATR
  // values as u-multiples without converting → every threshold shipped 4× too tight (0.25·u ≈
  // 0.0625 ATR ≠ 0.25 ATR). Each key below records its ATR equivalent; tests/25 asserts it.
  episode: {
    zoneHalfWidthU: 1.0,      // ×u = 0.25·ATR (Addendum §6.1 zone half-width). S4.1: was zoneAtrMult 0.25 (4× too tight)
    atr: { period: 14, grain: 'daily', asOf: 'D-1' }, // parent §6.1 (drives ATR(14) → distanceUnit)
    open: { fromOutside: true, supportFromAbove: true, resistanceFromBelow: true }, // parent §6.1
    closeSeparationU: 4.0,    // ×u = 1.0·ATR (Addendum §6.1 episode-close separation). S4.1: was closeSeparationAtr 1.0 (4× too tight)
    closeMinSessionsOutside: 1, // parent §6.1: remain outside ≥1 full session
    freshApproachRequired: true, // parent §6.1
    timeOnlyRearm: false,        // parent §6.1: time alone never re-arms
    oneEventPerFamilyPerEpisode: true, // parent §6.1
    touchAt: 'first 5-min bar of zone entry within episode', // parent §3.1/§6.1
    gapThroughDisposition: 'GAP_BREAK', // parent §6.1: gap through zone without trading in it
    crossLevelDedup: { // parent §6.2
      dedupIntersectU: 2.0, // ×u = 0.5·ATR (Addendum §6.2 dedup radius). S4.1: was intersectAtr 0.5 (4× too tight)
      assignOrder: ['highest_family_tier', 'nearest_anchor', 'elder_family'], // parent §6.2
      recordShadowed: true, // losing zones recorded as shadowedFamilyIds; their episode state still advances
    },
    // The role-flip threshold (0.5·u total) is DECOUPLED and lives in levels.lineage.roleMachine
    // (zoneHalfWidthUnits 0.25 + flipBeyondOppositeBoundaryUnits 0.25). It must NOT track this zone
    // (S4.1 §2b): its flip rate was measured and accepted at 0.5·u, and the role machine does not
    // move this session. episode zone and role zone share the family ANCHOR (center), not the width.
  },

  // ── Stage 3: Hourly confirmation taxonomy (parent §7) ──────────────────────
  hourlyClass: {
    units: 'daily_ATR', // parent §7: sign-normalized in daily-ATR units
    window: 'touch hourly bar + next hourly bar', // parent §3.2/§7
    // P = penetration depth beyond level; C = window-close position (+ toward hold side);
    // W = max rejection wick with close on hold side. (parent §7)
    classes: {
      SHARP_REJECT: { penetrationMax: 0.35, closeMin: 0.25, wickMin: 0.30 }, // P ≤ 0.35 AND C ≥ +0.25 AND W ≥ 0.30
      DRIFT_HOLD: { penetrationMax: 0.35, closeMin: 0.0, closeMaxExclusive: 0.25 }, // P ≤ 0.35 AND 0 ≤ C < +0.25
      BREAK_HOLD: { penetrationMinExclusive: 0.35, closeMax: -0.15 }, // P > 0.35 AND C ≤ −0.15
      BREAK_RECLAIM: { penetrationMinExclusive: 0.35, closeMin: 0.10 }, // P > 0.35 AND C ≥ +0.10
      CHOP: 'else', // everything else
    },
    evaluationOrder: ['SHARP_REJECT', 'DRIFT_HOLD', 'BREAK_HOLD', 'BREAK_RECLAIM', 'CHOP'], // CHOICE: table order; CHOP is the residual
    rvolOverlay: { grain: 'hourly', atTouchBar: true, hourOfDayMatched: true, baselineDays: 20 }, // parent §7
    existsOnlyAfterConfirmationAt: true, // parent §7: class does not exist before confirmationAt
  },

  // ── Stage 4: Features (parent §8; Addendum §A2–§A5) ────────────────────────
  features: {
    availabilityClasses: ['pre_touch', 'post_touch'], // parent §8.1 / Addendum standing rule 1
    nullNeverZero: true,        // parent §6.3 / Addendum rule 5
    snapshotImmutable: true,    // Addendum §A1 rule 3: knownAt-stamped, never recomputed
    storedNotFilters: true,     // Addendum rule 2: context features never filter events

    fingerprint: { // parent §8.2 (5-min, session open → touch); all pre_touch
      approach_velocity: 'ATR/hr over 90 min into touch',
      rvol_approach: 'time-of-day-matched cumulative',
      vwap_side: null, vwap_dist: 'ATR',
      consol_tightness: '60-min range in ATR',
      tod_bucket: ['open', 'midday', 'power'], // parent §8.2 names; see todBucketEtCutoffs below
      gap_context: { toward: true, away: true, none: true, thresholdAtr: 0.3 }, // parent §8.2: at 0.3 ATR
      // S3-R1 (founder ruling — closes S2 ⚠ flag #6): ET-minute cutoffs, [start, end).
      // open 09:30–10:30, midday 10:30–14:30, power 14:30–16:00, all ET.
      todBucketEtCutoffs: { open: [570, 630], midday: [630, 870], power: [870, 960] }, // S3-R1
      // S5-C1 (pre-registered BEFORE outcomes; P3's three RVOL buckets). 1.0 = normal volume
      // for that time of day. Fixed edges, not data-derived — the honest pre-registration.
      rvolApproachBuckets: { LOW: [null, 0.8], MID: [0.8, 1.5], HIGH: [1.5, null] }, // [lo, hi): LOW <0.8, MID 0.8–1.5, HIGH ≥1.5
    },
    momentumQuality: { // parent §8.3 (stored features)
      keys: ['path_efficiency', 'accel_final_30m', 'pullback_depth_max', 'hl_progression',
        'dist_from_opening_range', 'dist_from_session_extreme', 'prior_probe_count', 'vol_slope_into_touch'],
      openingRangeMinutes: 30, // parent §8.3: OR30
    },
    higherTf: { // parent §8.4 (stored features)
      trendStack: [20, 50], // weekly & monthly 20/50-period stack
      smaWeeks: [20, 50],
      distances: ['52w_high_pct', '52w_low_pct'],
      dailyAtrPercentile: true, rangeCompressionPercentileDays: 20,
      hhllStructure: ['weekly', 'monthly'],
    },
    relativeMomentum: { // parent §8.4 (stored features)
      returnsVsSpyDays: [5, 20, 60], returnsVsSectorDays: [5, 20, 60],
      betaAdjustedExcess: { betaDays: 60 },
      sectorDirectionAtTouch: true, spyDirectionAtTouch: true,
    },

    // Addendum context layers (all stored, availability-classed, null-never-zero).
    group: { // Addendum §A2
      peer_level_event_rate_prior_5d: { window: 'D-5..D-1', availability: 'pre_touch' }, // §A2.1
      peer_fresh_extreme_rate_prior_5d: { window: 'D-5..D-1', availability: 'pre_touch', freshExtremeDays: 63 }, // §A2.1
      peer_confirmations_same_session_before_touch: { availability: 'pre_touch', rule: 'peer confirmationAt < this touchAt' }, // §A2.1
      peer_level_event_rate_next_5d: { window: 'D+1..D+5', availability: 'post_touch' }, // §A2.1 descriptive only
      eligible_peer_count: { availability: 'pre_touch' }, // §A2.1
      minEligiblePeers: 5, // §A2.1: all rate features null when eligible_peer_count < 5
      rs: ['rs_vs_sector_5d', 'rs_vs_sector_20d', 'rs_vs_sector_60d', 'sector_rs_vs_spy_20d', 'sector_rs_vs_spy_60d', 'rs_rank_in_group'], // §A2.2
      atTouchDirection: { source: 'last fully-completed 5m ETF bar strictly before touchAt', tags: ['sector_direction_at_touch', 'spy_direction_at_touch'] }, // §A2.3
    },
    market: { // Addendum §A3
      breadth: {
        pctAboveMa: [20, 50], // §A3.2 breadth_pct_above_20dma/_50dma
        nhNlNetDays: 63,      // §A3.2 nh_nl_net_63d
        betaAppetite: 'SPHB-SPLV 20-day return spread', // §A3.2 beta_appetite_20d
        betaAppetiteGrain: 'daily', // S3-R4 (F4 ruling): a daily feature — SPHB/SPLV 5m never fetched/referenced
        volRegimePctile: { spyRealizedVolDays: 20, trailingYears: 2 }, // §A3.2 vol_regime_pctile (warmup-dependent)
      },
    },
    catalystRefs: 'see config.catalyst', // Addendum §A5 (kept in its own top-level block below)
  },

  // ── Layer 2: Regime & breadth (Addendum §A3) ───────────────────────────────
  regime: {
    momoSpread: { // §A3.1
      rankAt: 'T-21', lookbackReturnDays: 60, vsSpy: true, decileFraction: 0.1, spreadWindowSessions: 20,
    },
    rawSpreadKeptAsContext: true,     // §A3.1 raw_momo_spread_20d
    sectorNeutralDrivesState: true,   // §A3.1 sector_neutral_momo_spread_20d drives regime
    states: { // §A3.1 (computed on the sector-neutral spread)
      MOMO_ON: { spreadMinPct: 2.0, slopeSessions: 5, slopeMin: 0 }, // spread ≥ +2.0% AND 5-session slope ≥ 0
      MOMO_OFF: { spreadMaxPct: -2.0 }, // spread ≤ −2.0%
      NEUTRAL: 'else',
    },
    warmupSpinupSessions: 81, // §A3.1 / §A6: 81-session regime-meter spin-up
  },

  // ── Layer 3: Run maturity & extension (Addendum §A4) ───────────────────────
  trend: {
    primaryOrigin: { lookbackSessions: 252, minAdvanceAtr: 4 }, // §A4.1 v1.0 def, kept for macro context
    currentLegOrigin: { // §A4.1 drives extension & base counting
      swingFractalK: 3, minAdvanceAtr: 3.0, // most recent confirmed swing low, price advanced ≥3.0 daily-ATR
      invalidateOnDailyCloseBelow: true,     // daily close below origin kills the leg
      deepPullbackResetPct: 50,              // correction retracing >50% of leg gain → reset on new swing + fresh ≥3 ATR
      sidewaysResetSessions: 30, sidewaysResetBandAtr: 2.5, // ≥30 sessions within 2.5 ATR band ends the leg
      multipleQualifying: 'most_recent',     // most recent wins
    },
    baseCount: { minSessions: 10, bandAtr: 2.5, afterLegAtr: 3, countFrom: 'current_leg_origin' }, // §A4.1
    extension: { // §A4.2
      signNormalized: true,
      formula: 'support: (close-50DMA)/ATR ; resistance: (50DMA-close)/ATR', maPeriod: 50, // §A4.2 (positive = extended in continuation direction)
      pctileTrailingSessions: 504, pctileMinSessions: 252, // §A4.2 percentile vs trailing 504-session sign-normalized series
      buckets: { NOT_EXT: '<50', MID: '50-85', EXT: '>85' }, // §A4.2 percentile buckets
    },
  },

  // ── Layer 4: Move origin & earnings (Addendum §A5; A3) ─────────────────────
  catalyst: {
    originClass: { // §A5.1
      EARNINGS_GAP: { gapMinAtr: 1.0, earningsWithinSessions: 1, atLegOriginOrFirstNSessions: 5 }, // gap ≥1.0 ATR within ±1 session of known earnings, at leg origin or first 5 sessions
      NON_EARNINGS_GAP: { gapMinAtr: 1.0, noEarningsWithinSessions: 1 }, // same-size gap, no earnings within ±1 session (renamed from NEWS_GAP)
      NO_GAP: 'neither',
      nullWhenLegOriginNull: true, // §A5.1
    },
    earnings: { // §A5.2 / A3
      sessions_since_last_earnings: { availability: 'pre_touch' }, // trailing-only
      sessions_to_next_earnings_actual: { availability: 'post_touch', descriptiveOnly: true }, // A3: reflects current state only; barred from predictive cuts
      sessions_to_expected_earnings: { // §A5.2 the pre_touch predictive proxy
        availability: 'pre_touch',
        method: 'last known report date + median trailing inter-report gap',
        minPriorReports: 2, // else null
        storesExpectedVsActualError: true, // descriptive, post-hoc accuracy disclosure
      },
      records: ['earningsDate', 'earningsDateSource'], // §A5.2 (source = actual!==null ? "reported" : "scheduled" — current-state tag only, per A3)
      degradeOnCalendarFail: 'move_origin → GAP/NO_GAP; all earnings features null', // §A5.2
      scheduledDatesAreNotHistoricallyKnown: true, // A3: hard guard — never treat calendar scheduled-dates as point-in-time known
    },
  },

  // ── Stage 5: Outcomes (parent §9) ──────────────────────────────────────────
  outcomes: {
    origins: ['touchAt', 'entryAt'], // parent §9.1: grid computed twice per event
    measuredOn: '5-min closes; excursions on 5-min highs/lows', // parent §9.1
    signNormalizedTowardHoldSide: true, // parent §9.1
    horizons: ['15m', '30m', '60m', '120m', 'EOD', 'nextOpen', 'nextEOD'], // parent §9.1
    heldBeyondAtr: 0.25, // parent §9.1: held_{horizon} = no 5-min close beyond level by >0.25 ATR
    timeToFavorableAtr: [0.25, 0.50, 0.75, 1.00], // parent §9.1: time_to_{}_ATR favorable (minutes; null if not reached by nextEOD)
    targetBeforeStop: { targetsAtr: [0.50, 0.75, 1.00, 1.50], stopsAtr: [0.25, 0.50, 0.75] }, // parent §9.1
    drawdownBeforeTargetAtr: 0.75, // parent §9.1: MAE before 0.75 ATR target (null if never reached)
    closePositionInRange: true,    // parent §9.1: 0–1
    overnightGapAtr: true,         // parent §9.1: next-open minus session-close excursion, ATR
    resolutionStates: ['held', 'broke', 'reclaimed_after_break'], // parent §9.1: resolution at nextEOD
    bridge: { // parent §9.2
      moveBeforeConfirmation: 'touchAt→entryAt signed excursion toward hold side, ATR',
      moveRemainingAfterConfirmation: 'MFE from entryAt through EOD, ATR',
      fractionElapsedAtEntry: 'moveBefore / (moveBefore + moveRemaining)',
      fractionElapsedNullBelowAtr: 0.25, // parent §9.2: null when denominator < 0.25 ATR
    },
    ambiguity: { // parent §9.3
      rule: 'adverse_first', // same-bar target/stop collisions resolve adverse-first
      countAmbiguousBars: true, flagCell: 'ambiguous',
      escalationPctThreshold: 10, escalateTo: '1-min', label: 'RESOLUTION_LIMITED', // >10% ambiguous on a primary pair
      cleanBounce: { mfeMinAtr: 0.75, beforeMaeAtr: 0.50 }, // parent §9.3: clean_bounce
    },
    entryAt: { // parent §3.3
      rule: 'open of first tradable 5-min bar strictly after confirmationAt',
      overnightCutoffEtMinutes: 955, // if confirmationAt ≥ 15:55 ET → next session opening bar
      overnightFlag: 'overnightEntry',
    },
  },

  // ── Stage 6: Aggregation, statistics, honesty gates (parent §10, §11, §15) ─
  honesty: {
    floors: { minNForPct: 5, minNForMedian: 3, belowFloorLabel: 'n<5 — insufficient' }, // parent §10.3
    siblingComparisonOnly: true, // parent §10.3: condition-vs-condition, never vs pooled headline
    noCompositeScore: true,      // parent §10.3 / §11.3 guard
    displayAgreementRoundingDp: 2, // parent §10.3 / BUILD_RULES §9
    bootstrap: { clustering: 'date', iterations: 2000, ciPct: 90 }, // parent §11.2
    stabilityReview: ['leave_one_symbol_out', 'leave_one_sector_out', 'leave_one_5session_market_episode_out'], // parent §11.2
    stabilityFailsIfSignFlips: true, // parent §11.2
    concentrationDiagnostics: ['unique_event_dates_per_bucket', 'top5_symbol_pct'], // parent §11.2
    incrementalLift: { // parent §11.3
      model: 'logistic', perPrimaryQuestion: true,
      inputs: ['family_tier', 'hourly_class', 'side', 'tod_bucket', 'vol_regime_pctile', 'spy_direction_at_touch', 'symbol_random_effect'],
      reportAs: 'directional appendix only; never a displayed composite score',
    },
    holdout: { // parent §11.4
      singleOpen: true, // opens once, after all in-sample work incl. knob sensitivity is frozen
      graduationAllOf: [
        'in-sample sibling difference 90% date-clustered CI excludes zero',
        'in-sample stability review passes',
        'holdout effect direction agrees',
        'holdout point estimate within in-sample 90% CI',
      ],
      verdicts: ['CONFIRMED', 'UNCONFIRMED', 'DEAD'], // parent §11.4
      failedBucketIsDead: true, // no re-tune against same holdout; next attempt needs new months
    },
    acceptance: { // parent §15 — a bucket informs trading only when ALL hold
      minN: 30, // in-sample independent episodes (raised from 20)
      // S5-A2 (pre-registration amendment, founder-ruled 2026-07-12, BEFORE any outcome exists):
      // the date-clustered bootstrap resamples DATES, so a cell's effective n is its unique-date
      // count (in-sample events span ~609/609 sessions — every session fires; n=60 on 12 dates is
      // far weaker than n=60 on 50). Every reported cell carries uniqueDates. Vocabulary: budget
      // CHECKPOINTS label a cell failing either floor 'UNDERPOWERED' (pre-outcome power language);
      // at the S6+ ACCEPTANCE gate the same failure renders the bucket 'UNCONFIRMED' (honesty.verdicts).
      minUniqueDates: 15, // S5-A2 — in addition to minN
      minSiblingDiffPoints: 15, // AND its 90% clustered CI excludes zero
      stabilityMustPass: true,
      holdoutMustConfirm: true,
      confirmationTimeAsymmetry: { medianRemainingMfeToMaeMult: 2 }, // median remaining MFE ≥ 2× median MAE
    },
    footer: [ // parent §10.3
      'universe + survivorship note', 'verified data range', 'config version',
      'event counts before/after episode filtering', 'unique-event-date count',
      'top-5-symbol contribution %', 'ambiguity rates', 'corporate-action exclusion count',
    ],
  },

  // ── Pre-registered primary questions (parent §10.1 P1–P5; Addendum §A4.3 P6) ─
  primaryQuestions: {
    // Each is run SEPARATELY for support and resistance (parent §10.2).
    P1: { study: 'confirmation-time', q: 'Does hourly_class predict held_EOD from entryAt? (F2+ levels)', endpoint: 'held_EOD', origin: 'entryAt', gate: 'F2+' }, // parent §10.1
    P2: { study: 'bridge', q: 'Per hourly class: distribution of fractionElapsedAtEntry; is remaining MFE-vs-MAE from entryAt still favorable?', endpoint: 'fractionElapsedAtEntry + remaining MFE/MAE', origin: 'entryAt' }, // parent §10.1
    P3: { study: 'touch-time', q: 'Does rvol_approach bucket predict clean_bounce from touchAt? (within F2+, pre_touch only)', endpoint: 'clean_bounce', origin: 'touchAt', gate: 'F2+' }, // parent §10.1
    // S5-A1 (pre-registration amendment, founder-ruled 2026-07-12, BEFORE any outcome exists):
    // F3 events are 3–12/symbol over the full window — split by side within SHARP_REJECT the F3
    // cell is structurally below any honest floor, permanently. P4's primary comparison becomes
    // F1 vs F2. F3 events are NOT discarded: they pool into F2+ wherever F2+ gates (P1/P2/P3/P6
    // unchanged) and appear as a descriptive footnote in the exploratory appendix.
    P4: { study: 'confirmation-time', q: 'Does family tier (F1 vs F2) predict held_EOD within SHARP_REJECT?', endpoint: 'held_EOD', origin: 'entryAt', within: 'SHARP_REJECT', compare: ['F1', 'F2'], f3Disposition: 'pooled into F2+ gates; exploratory footnote only' }, // parent §10.1 as amended S5-A1
    P5: { study: 'confirmation-time', q: 'BREAK_RECLAIM vs DRIFT_HOLD: forward MFE from entryAt (trap-pattern question)', endpoint: 'forward MFE', origin: 'entryAt', compare: ['BREAK_RECLAIM', 'DRIFT_HOLD'] }, // parent §10.1
    P6: { // Addendum §A4.3 (confirmation-time, per side)
      study: 'confirmation-time',
      q: 'Among SHARP_REJECT-confirmed events at F2+ levels, does EXT vs NOT_EXT predict clean_bounce from entryAt?',
      endpoint: 'clean_bounce', origin: 'entryAt', gate: 'F2+', within: 'SHARP_REJECT',
      primaryComparison: ['EXT', 'NOT_EXT'], midDisplayedNotTested: true,
      interactionTest: 'does EXT-vs-NOT_EXT difference differ across momo_regime states? (one test)',
      secondaryDiagnostics: ['MFE_EOD', 'held_EOD', 'fractionElapsedAtEntry'],
      exploratory: ['base_count splits', 'MID-bucket comparisons'],
      minMeaningfulDiffPoints: 10, ciExcludesZero: true, holdoutDirectionAgrees: true,
      // Fallback ladder (Addendum §A4.3, locked now):
      sampleBudgetFallback: 'if either side EXT or NOT_EXT cell < n=30: interaction test drops first (regime → within-table annotation); per-side primary comparison protected last',
      // Leg-detection fallback (Addendum §A4.1):
      legDetectionFallback: 'if leg detection demotes (<80% manual agreement): extension percentile recomputed against 50DMA+ATR-only form (survives); only base_count and leg-relative features demote',
    },
  },

  // ── Manual validation (parent §12; Addendum §A4.1) ─────────────────────────
  manualReview: {
    sampleSize: 100, // parent §12
    stratified: ['mega_cap_tech', 'low_volatility', 'high_beta', 'gap_prone'], // parent §12
    garbageGatePct: 10, // parent §12: >10% garbage blocks aggregation
    componentGradingSlices: ['event_validity', 'leg_origin_detection', 'base_count'], // Addendum §A4.1
    demoteBelowAgreementPct: 80, // Addendum §A4.1: <80% agreement demotes that component to exploratory-only
  },

  // ── Sample-size budget (parent §13) ────────────────────────────────────────
  sampleBudget: {
    episodesPerSymbolPerMonth: { min: 1, max: 2 }, // parent §13
    assumedMultiplier: 1.5, symbols: 175, inSampleMonths: 29, // parent §13
    projectedInSampleEvents: 7600, // parent §13 (~175 × 29 × 1.5)
    rarestCellProjectedN: { min: 40, max: 80 }, // parent §13
    checkpointMinN: 30, // parent §13 / §15: any primary cell < n=30 triggers a scope decision at Session-3 checkpoint
  },

  // ── Diagnostics: anomaly-scan sensitivity guards (S4 §2) ───────────────────
  // These gate ONLY the anomaly-scan warnings written to _stats.json / console — they
  // touch no per-symbol level or event artifact, so provenance is unaffected and the
  // config version stays 3 (no consumer of these values exists downstream — S4 §2).
  diagnostics: {
    anomalyScan: {
      madMedianFloorFrac: 0.05, // S4 §2.1: a metric flags a MAD outlier only when MAD ≥ 5% of |median| (tight distributions can't produce a meaningful MAD)
      crossStrataMinEvents: 20,  // S4 §2.2: cross-strata correlations reported 'insufficient' below this total event count across the universe
    },
  },

  // ── Report structure (Addendum §A7) ────────────────────────────────────────
  report: {
    viewsPerCohort: ['pattern', 'context', 'comparative', 'validation'], // Addendum §A7
  },
};

// Immutability enforcement only — computes no config value. (Honors the parent §3 /
// S2-prompt "plain frozen object, no logic" intent: config is pure data; this just
// makes the pure data un-mutable so a later session cannot silently retune a knob.)
function deepFreeze(obj) {
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

// Geometry coherence validation (S3.5 §3) — like deepFreeze, this COMPUTES no config
// value; it only rejects an incoherent one. The ordering invariants are not negotiable:
// a violating config must throw at load, never silently produce incoherent lineage.
export function validateGeometry(geometry) {
  const { atrMultiple, floorPct, capPct } = geometry.distanceUnit;
  const { kCluster, kConfluence, kMerge, kMatch, kSplit } = geometry.multiples;
  const fail = (msg) => { throw new Error(`config geometry invariant violated: ${msg}`); };
  if (!(atrMultiple > 0)) fail(`atrMultiple ${atrMultiple} must be > 0`);
  if (!(floorPct > 0 && capPct > 0)) fail('floorPct and capPct must be > 0');
  if (!(floorPct <= capPct)) fail(`floorPct ${floorPct} must be ≤ capPct ${capPct}`);
  for (const [k, v] of Object.entries(geometry.multiples)) if (!(v > 0)) fail(`${k} ${v} must be > 0`);
  if (!(kCluster <= kConfluence)) fail(`kCluster ${kCluster} must be ≤ kConfluence ${kConfluence}`);
  if (!(kConfluence < kMatch)) fail(`kConfluence ${kConfluence} must be < kMatch ${kMatch}`);
  if (!(kMerge < kMatch)) fail(`kMerge ${kMerge} must be < kMatch ${kMatch}`);
  if (!(kSplit > kMatch)) fail(`kSplit ${kSplit} must be > kMatch ${kMatch}`);
  // Live-support coherence (S3.5 §7a): merge evidence needs two DISTINCT snapshots
  // (level gap > kConfluence·u) with anchors within kMerge·u — kMerge ≤ kConfluence
  // would make merges structurally unreachable.
  if (!(kConfluence < kMerge)) fail(`kConfluence ${kConfluence} must be < kMerge ${kMerge} (merge reachability under live support)`);
  return geometry;
}

validateGeometry(CONFIG.levels.geometry);

export default deepFreeze(CONFIG);
