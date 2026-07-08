/**
 * POST /api/research/correlation — Correlation Intelligence V0 (Build Spec V1.2).
 *
 * On-demand, user-facing (requireAuth — NOT a cron endpoint): takes an equity
 * group (1–10 tickers; an ETF proxy is a group of one) and a registry driver,
 * and returns rolling 20/60d return correlations, a rolling-40 classical-OLS
 * beta series (headline beta = the LATEST element of that series — the big
 * number and the chart line can never disagree), pinned lead-lag, robust-SDS
 * correlation-regime inflection episodes, and non-overlapping forward-return
 * base rates for both the group composite and the driver.
 *
 * Array-order boundary: EODHD serves NEWEST-FIRST (order=d); this handler
 * reverses ONCE, immediately after fetch — everything downstream (and all of
 * correlationMath.js) is chronological OLDEST-FIRST.
 *
 * Caching: new Firestore collection `correlationIntelligence` (this build
 * writes no existing collection), dual-freshness in-doc
 * { payload, computedAt, expiresAt, ttlMs } (the indexIntelligence/
 * stockRankings idiom) plus L1 serverCache with a STATIC ttl (no dataType —
 * the TTL below already encodes market awareness). TTL rule (pinned,
 * two-sided): before today's close + 30min → expire at today's close + 30min;
 * otherwise at the NEXT market close + 30min. The two-sided form exists
 * because in [close, close+30) getNextMarketClose() has already rolled to the
 * next session, but today's EOD bar is still landing — a 4:10pm fetch must
 * not lock in pre-update data for a full session.
 *
 * Partial-failure contract (pinned): driver fetch failed or ALL group members
 * failed → 422. SOME members failed → HTTP 200 with meta.partial=true +
 * meta.droppedSymbols, computed over survivors, and NOT cached in either
 * layer — a transient member failure must not poison the full group's cache
 * key until TTL expiry.
 */
import { createHash } from 'crypto';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { getFromCache, setInCache } from '../_utils/serverCache.js';
import {
  rollingBeta,
  leadLag,
  detectInflections,
  forwardReturns,
  standardizedDivergenceScore,
  trailingReturnInto,
  rollingStd,
  maskedPearson,
  compareConditionalSides,
  median,
  computeReturnsSeries,
  pairwiseCohesion,
  memberContribution,
  partialCorrelationWindows,
  selfPercentile,
  maskedBeta,
  compareCaptureSides,
  tailCoMovement,
  correlationStability,
  SDS_BASELINE_WINDOW,
} from '../_utils/correlationMath.js';
// V2 Build 2 extraction: the join-and-compute core and the two-sided cache TTL
// moved VERBATIM to correlationAssembly.js so the multi-driver scan runs the
// IDENTICAL per-driver pipeline. This suite passing with zero expectation
// changes is the extraction's acceptance test.
import {
  assembleDriverCore,
  computeCorrelationCacheTtlMs,
  tensionStateFrom,
  projectAlignedReturns,
  MIN_CLOSES_FOR_INFLECTIONS,
} from './correlationAssembly.js';
// V2 Build 3 — break context: per-episode technical state at the flag and the
// 50DMA-conditioned base rates. breakContext.js owns THE chronological→
// newest-first order adapter for its call-only technicalCalculations use.
// V2 Build 4 adds trendStateSeries from the same adapter home (the per-day
// vs-50DMA state the trend-state condition masks on).
import { computeContextAtFlag, conditionedBaseRates, trendStateSeries } from './breakContext.js';
import { CORRELATION_DRIVERS } from './driverRegistry.js';
import { fetchAllSeries, fetchEodCloses } from './fetchDriverSeries.js';
import { normalizeSymbolForEODHD } from '../_utils/symbolNormalize.js';
// api→src cross-boundary flag import (scouting-board.js precedent). Node-clean
// per BUILD_RULES §4; the unmocked handler import in
// correlation.boundary.test.js is the dependency-surface guard.
import {
  CORRELATION_LAB_ENABLED,
  CORRELATION_RELATIONSHIP_QUALITY_ENABLED,
} from '../../src/config/featureFlags.js';

// Up to 11 EODHD fetches in 3 throttled chunks (~600ms of deliberate sleep)
// plus Firestore round-trips — heavier than scouting-board's read-only 10s.
export const config = { maxDuration: 30 };

const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,9}$/; // pinned: accepts BRK.B, BF.B, hyphens
const LOOKBACK = { DEFAULT: 504, MIN: 150, MAX: 1260 };
const BETA_WINDOW = 40;
// V2 Build 4 — conditional correlation (pinned): 60 observations minimum per
// side, composite 20d rolling std for the vol-regime split.
const CONDITIONAL_MIN_OBS = 60;
const VOL_REGIME_WINDOW = 20;

const markCached = (payload) => ({ ...payload, meta: { ...payload.meta, cached: true } });

const latestValue = (series) => (series && series.length ? series[series.length - 1].value : null);

// ── V2 Build 4 — condition masks + conditional-correlation assembly ─────────
// Named exports (not a second module): the masks are single-driver-endpoint
// logic per the Build 4 spec, and the boundary suite already imports this
// handler file, so the mask construction unit-tests where it lives. The scan
// endpoint never calls any of this.

/**
 * The three condition masks over the JOINED chronological sample, all in the
 * RETURN index space (return i = closes[i]→closes[i+1], ending at close index
 * i + 1 — the correlationMath.js mapping contract). A day joins a side only
 * when its condition has a reading; excluded days are false in BOTH masks.
 *
 *   driverUp/driverDown — driver return sign; exactly-zero returns excluded.
 *     (TNX diff mode: the sign of the yield CHANGE — up means the yield rose.)
 *   volHigh/volCalm — composite 20d rolling std (window ENDING that day) vs
 *     the MEDIAN of that vol series over the sample; > median = high-vol,
 *     ≤ median = calm; the first VOL_REGIME_WINDOW − 1 return days have no
 *     reading. Median over non-null readings; null readings join neither side.
 *   trendUp/trendDown — composite level vs its 50DMA on the day the return
 *     lands (trendStateSeries at close index i + 1, the breakContext
 *     inclusive-window convention); days without a full 50-level window join
 *     neither side.
 *
 * All three are same-day DESCRIPTIVE splits of the sample — nothing here is,
 * or feeds, a look-ahead signal.
 */
export function buildConditionMasks({ driverReturns, groupReturns, groupLevels, joinedDates }) {
  const n = driverReturns.length;
  const driverUp = driverReturns.map((r) => r > 0);
  const driverDown = driverReturns.map((r) => r < 0);

  const volHigh = new Array(n).fill(false);
  const volCalm = new Array(n).fill(false);
  const volSeries = rollingStd(groupReturns, VOL_REGIME_WINDOW, joinedDates) ?? [];
  const volValues = volSeries.map((e) => e.value).filter((v) => v != null);
  if (volValues.length) {
    // The shared median — the SAME implementation every other statistic in the
    // correlation stack uses (one implementation per concept; review fix).
    const volMedian = median(volValues);
    for (const e of volSeries) {
      if (e.value == null) continue;
      const i = e.closeIndex - 1; // the return index the window ends at
      if (e.value > volMedian) volHigh[i] = true;
      else volCalm[i] = true;
    }
  }

  const trendUp = new Array(n).fill(false);
  const trendDown = new Array(n).fill(false);
  const trend = trendStateSeries(groupLevels) ?? [];
  for (let i = 0; i < n; i++) {
    if (trend[i + 1] === 'up') trendUp[i] = true;
    else if (trend[i + 1] === 'down') trendDown[i] = true;
  }

  return { driverUp, driverDown, volHigh, volCalm, trendUp, trendDown };
}

/**
 * The `conditional` response block: group×driver correlation split by driver
 * direction, vol regime, and trend state — side vs side ONLY (the honesty
 * core lives in compareConditionalSides' JSDoc: conditioning truncates
 * variance and lowers BOTH sides, so neither side is ever compared to the
 * full-sample headline, in data or in copy).
 *
 * Each side is { corr, n } | null (null below CONDITIONAL_MIN_OBS or
 * degenerate); asymmetric/direction come from compareConditionalSides
 * (asymmetric null when either side is null — no comparison, never a
 * fabricated verdict; direction is remapped from 'A'/'B' to the side key).
 * `counts` carries the raw per-side day counts so the UI's insufficient copy
 * can name the real n of a null side, and `minObs` carries the floor so that
 * copy can never drift from the server's gate. `sides` is the ordered
 * [sideA, sideB] key pair — the SERVER owns the side vocabulary (review fix:
 * a client-side mirror of these keys fails confidently-wrong on a rename;
 * JSON object key order is serialization-fragile, an array is not).
 */
export function computeConditional({ driverReturns, groupReturns, groupLevels, joinedDates, registry }) {
  const masks = buildConditionMasks({ driverReturns, groupReturns, groupLevels, joinedDates });
  const sideOf = (mask) => maskedPearson(groupReturns, driverReturns, mask, CONDITIONAL_MIN_OBS);
  const countOf = (mask) => mask.reduce((acc, m) => acc + (m === true ? 1 : 0), 0);
  const block = (maskA, maskB, keyA, keyB, labels) => {
    const a = sideOf(maskA);
    const b = sideOf(maskB);
    const cmp = compareConditionalSides(a, b);
    return {
      [keyA]: a,
      [keyB]: b,
      sides: [keyA, keyB],
      asymmetric: cmp ? cmp.asymmetric : null,
      direction: cmp?.direction ? (cmp.direction === 'A' ? keyA : keyB) : null,
      // A meaningful sign reversal between the two subsets — a distinct verdict
      // from "tighter" (see compareConditionalSides). Null when no comparison.
      flipped: cmp ? cmp.flipped : null,
      counts: { [keyA]: countOf(maskA), [keyB]: countOf(maskB) },
      labels,
    };
  };
  // Direction labels from the registry: "days {noun} rose/fell". TNX carries
  // directionNoun ("the 10Y yield") — its up-day means the yield rose, and a
  // bare +/− would be dishonest for a diff-mode driver.
  const noun = registry.directionNoun ?? registry.label;
  return {
    minObs: CONDITIONAL_MIN_OBS,
    driverDirection: block(masks.driverUp, masks.driverDown, 'up', 'down', {
      up: `days ${noun} rose`,
      down: `days ${noun} fell`,
    }),
    volRegime: block(masks.volHigh, masks.volCalm, 'high', 'calm', {
      high: 'high-vol days',
      calm: 'calm days',
    }),
    trendState: block(masks.trendUp, masks.trendDown, 'up', 'down', {
      up: 'uptrend days',
      down: 'downtrend days',
    }),
  };
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Defense-in-depth for merge-dark: while the flag is off the endpoint reveals
  // nothing, performs no reads, and spends no EODHD quota. The client only
  // calls it from behind the same flag (scouting-board.js:66 pattern).
  if (!CORRELATION_LAB_ENABLED) return res.status(404).json({ error: 'not_found' });

  const user = await requireAuth(req, res);
  if (!user) return;

  // ── Validation (pinned) ──
  const body = req.body || {};
  const driverKey = typeof body.driver === 'string' ? body.driver : null;
  // CUSTOM is the synthetic pair-mode driver (any equity ticker) — NOT a
  // registry key. Every other driver must resolve in the registry.
  const isCustomDriver = driverKey === 'CUSTOM';
  const baseRegistry = driverKey && !isCustomDriver ? CORRELATION_DRIVERS[driverKey] : null;
  if (!isCustomDriver && !baseRegistry) {
    return res.status(400).json({ error: 'invalid_driver', message: 'Unknown driver key.' });
  }
  // customSymbol is valid ONLY with driver === 'CUSTOM'.
  const customRaw = typeof body.customSymbol === 'string' ? body.customSymbol.trim() : '';
  const customPresent = customRaw !== '';
  if (customPresent && !isCustomDriver) {
    return res.status(400).json({ error: 'invalid_custom_symbol', message: 'customSymbol is only valid with the CUSTOM driver.' });
  }
  if (isCustomDriver && !customPresent) {
    return res.status(400).json({ error: 'invalid_custom_symbol', message: 'The CUSTOM driver requires a customSymbol.' });
  }
  if (!Array.isArray(body.group) || body.group.length < 1 || body.group.length > 10) {
    return res.status(400).json({ error: 'invalid_group', message: 'group must be 1–10 symbols.' });
  }
  // Canonicalize to app-form tickers (uppercase, one trailing '.US' stripped)
  // BEFORE dedupe/regex/cache-key: 'SPY' and 'SPY.US' must be one member —
  // otherwise they double-weight the composite and split the cache key. The
  // fetch helper owns the EODHD wire form (dot→hyphen + '.US').
  const group = [
    ...new Set(body.group.map((s) => String(s).trim().toUpperCase().replace(/\.US$/, ''))),
  ];
  if (!group.every((s) => SYMBOL_RE.test(s))) {
    return res.status(400).json({ error: 'invalid_symbol', message: 'Invalid ticker symbol format.' });
  }

  // ── Driver resolution: a registry entry, OR a synthetic CUSTOM (pair-mode)
  //    entry built from the raw ticker through the SAME canonicalization +
  //    normalizeSymbolForEODHD path a group member takes (it IS an equity
  //    ticker). Everything downstream reads `registry` uniformly. ──
  let registry = baseRegistry;
  let customSymbol = ''; // canonical app-form; '' for registry drivers (cache key)
  if (isCustomDriver) {
    customSymbol = customRaw.toUpperCase().replace(/\.US$/, '');
    if (!SYMBOL_RE.test(customSymbol)) {
      return res.status(400).json({ error: 'invalid_custom_symbol', message: 'Invalid custom ticker symbol format.' });
    }
    // Self-correlation against a group member is degenerate and confusing.
    // Compare on the EODHD WIRE form — normalizeSymbolForEODHD collapses dots to
    // hyphens for share classes, so BRK.B vs BRK-B (which fetch the IDENTICAL
    // series) are caught, not just literal app-form matches. Matching the wire
    // form is what actually protects against a fabricated corr=1/beta=1 result.
    const customWire = `${normalizeSymbolForEODHD(customSymbol)}.US`;
    if (group.some((g) => `${normalizeSymbolForEODHD(g)}.US` === customWire)) {
      return res.status(400).json({
        error: 'custom_symbol_in_group',
        message: 'The custom ticker is already in the group — self-correlation is degenerate.',
      });
    }
    registry = {
      symbol: customWire,
      label: customSymbol,
      returnMode: 'pct',
      unit: '% change',
      betaInterpretation: `group % move per 1% move in ${customSymbol}`,
    };
  }

  let lookbackDays = LOOKBACK.DEFAULT;
  if (body.lookbackDays !== undefined) {
    if (typeof body.lookbackDays !== 'number' || !Number.isFinite(body.lookbackDays)) {
      return res.status(400).json({ error: 'invalid_lookback', message: 'lookbackDays must be a number.' });
    }
    lookbackDays = Math.min(LOOKBACK.MAX, Math.max(LOOKBACK.MIN, Math.round(body.lookbackDays)));
  }
  const forceRefresh = body.forceRefresh === true;

  if (!process.env.EODHD_API_KEY) {
    return res.status(500).json({ error: 'API not configured' });
  }

  // Cache key incorporates the custom symbol so two CUSTOM runs with different
  // tickers never collide. The `:<customSymbol>` segment ('' for registry
  // drivers) changes the key composition for ALL entries — acceptable: daily
  // expiry, no migration (noted in the PR).
  const docId = createHash('sha1')
    .update([...group].sort().join(',') + '|' + driverKey + ':' + customSymbol + '|' + lookbackDays)
    .digest('hex');
  const cacheKey = `correlation:${docId}`;

  try {
    const db = getFirebaseAdmin();

    // ── Cache read: L1 then Firestore (both bypassed by forceRefresh) ──
    if (!forceRefresh) {
      const l1 = getFromCache(cacheKey); // no dataType → static expiry
      if (l1) return res.status(200).json(markCached(l1));
      const snap = await db.collection('correlationIntelligence').doc(docId).get();
      if (snap.exists) {
        const doc = snap.data();
        if (doc?.payload && typeof doc.expiresAt === 'number' && Date.now() < doc.expiresAt) {
          setInCache(cacheKey, doc.payload, Math.floor((doc.expiresAt - Date.now()) / 1000));
          return res.status(200).json(markCached(doc.payload));
        }
      }
    }

    // ── Fetch (partial-failure contract) ──
    const { driverRows, memberRows, failedSymbols } = await fetchAllSeries({
      driverSymbol: registry.symbol,
      groupSymbols: group,
      lookbackDays,
    });
    if (!driverRows) {
      return res.status(422).json({ error: 'driver_unavailable', driver: driverKey });
    }
    const survivors = group.filter((s) => memberRows[s]);
    if (survivors.length === 0) {
      return res.status(422).json({ error: 'group_unavailable', droppedSymbols: failedSymbols });
    }
    const partial = failedSymbols.length > 0;

    // ── THE single reversal boundary: NEWEST-FIRST wire → OLDEST-FIRST ──
    const driverAsc = [...driverRows].reverse();
    const membersAsc = new Map(survivors.map((s) => [s, [...memberRows[s]].reverse()]));
    const memberMaps = survivors.map((s) => new Map(membersAsc.get(s).map((r) => [r.date, r.close])));

    // ── The shared join-and-compute core (correlationAssembly.js): level
    //    scaling → inner-join → lookback cap → returns → composite →
    //    gated corr 20/60 → closeIndex-aligned divergence series ──
    const core = assembleDriverCore({ driverAsc, memberMaps, registry, lookbackDays });
    if (core.error === 'no_overlapping_history') {
      return res.status(422).json({ error: 'no_overlapping_history', joinedCloses: core.joinedCloses });
    }
    if (core.error === 'degenerate_series') {
      return res.status(422).json({ error: 'degenerate_series' });
    }
    const {
      joinedCloses,
      joinedDates,
      driverCloses,
      driverReturns,
      groupReturns,
      groupLevels,
      corr20,
      corr60,
      divergenceSeries,
    } = core;

    // ── Deep-dive-only stats (the scan endpoint never computes these) ──
    const beta40 = joinedCloses >= BETA_WINDOW + 1 ? rollingBeta(groupReturns, driverReturns, BETA_WINDOW, joinedDates) : null;
    const lag = leadLag(groupReturns, driverReturns, 5);

    // Build 4 — conditional correlation ("when does the link hold?"): a
    // full-sample read over the joined return index space, independent of the
    // MIN_CLOSES_FOR_INFLECTIONS episode gate — each side self-nulls below the
    // 60-observation floor instead. Additive; pre-Build-4 cached payloads
    // simply lack the field and the UI null-guards it (daily expiry, no
    // migration — the Build 3 precedent).
    const conditional = computeConditional({
      driverReturns,
      groupReturns,
      groupLevels,
      joinedDates,
      registry,
    });

    // Build 5 — intra-group cohesion ("is this group even one thing right now?"):
    // the mean pairwise correlation among the group's OWN members at 20d/60d. The
    // aligned per-member return series stay internal to assembleDriverCore (they
    // only build the composite), so recompute them endpoint-side from the in-scope
    // memberMaps projected onto the core's (lookback-capped) joinedDates — the SAME
    // driver-inclusive joined calendar as every other stat on the page (deliberate
    // page-consistency); the pairwise correlation itself is among MEMBERS only (the
    // driver is not a cohesion member). 'pct' is bound to correlationAssembly.js's
    // memberReturns mode — if the core ever changes it, change here too. The core
    // already returned 422 for a degenerate member above, so these are non-null.
    const memberReturns = memberMaps.map((m) =>
      computeReturnsSeries(joinedDates.map((d) => m.get(d)), 'pct')
    );
    // Additive; pre-Build-5 cached payloads simply lack the field and the UI
    // null-guards it (daily expiry, no migration — the Build 3/4 precedent). The
    // whole block is null below 3 members: a 2-member "cohesion" is one pair
    // wearing a grand name, and an ETF-proxy group of one has nothing to cohere.
    const memberCount = survivors.length;
    const cohesion =
      memberCount >= 3
        ? {
            c20: pairwiseCohesion(memberReturns, 20),
            c60: pairwiseCohesion(memberReturns, 60),
            memberCount,
          }
        : null;

    // V3 Phase 1 Sub-build 1 — relationship-quality bundle (Bucket B). Additive
    // and flag-gated: while CORRELATION_RELATIONSHIP_QUALITY_ENABLED is off the
    // block is never computed, the extra SPY fetch never happens, and the field
    // is omitted from the payload → byte-identical to today. Pure math over the
    // series already assembled, except the one guarded SPY reference fetch.
    let relationshipQuality = null;
    if (CORRELATION_RELATIONSHIP_QUALITY_ENABLED) {
      // Partial correlation needs SPY on the SAME joined calendar. The driver IS
      // SPY (registry SPX, or a CUSTOM 'SPY') → self, no fetch, no partial.
      const driverIsSpy = registry.symbol === 'SPY.US';
      let spyMap = null;
      if (!driverIsSpy) {
        try {
          const spyRows = await fetchEodCloses('SPY.US', lookbackDays);
          if (Array.isArray(spyRows) && spyRows.length) {
            spyMap = new Map(spyRows.map((r) => [r.date, r.close]));
          }
        } catch {
          spyMap = null; // SPY reference unavailable → suppressed, never fails the response
        }
      }
      const spyReturns = spyMap ? projectAlignedReturns(spyMap, joinedDates) : null;
      const partial = driverIsSpy
        ? { w20: { skipped: 'self' }, w60: { skipped: 'self' } }
        : spyReturns
          ? partialCorrelationWindows(groupReturns, driverReturns, spyReturns)
          : { w20: { suppressed: 'spy_unavailable' }, w60: { suppressed: 'spy_unavailable' } };

      // Member contribution reuses the memberReturns already built for cohesion;
      // ≥3 members (the cohesion gate) — a 2-member leave-one-out is vacuous.
      const contributionCore =
        memberCount >= 3 ? memberContribution(memberReturns, driverReturns, 60) : null;
      const contribution = contributionCore
        ? { ...contributionCore, memberSymbols: survivors }
        : null;

      // Down/up-capture beta asymmetry — the trivial sign masks only (no vol/
      // trend), each side self-nulls below the 60-observation floor.
      const driverDown = driverReturns.map((r) => r < 0);
      const driverUp = driverReturns.map((r) => r > 0);
      const sideDown = maskedBeta(groupReturns, driverReturns, driverDown, CONDITIONAL_MIN_OBS);
      const sideUp = maskedBeta(groupReturns, driverReturns, driverUp, CONDITIONAL_MIN_OBS);
      const captureAsymmetry = {
        minObs: CONDITIONAL_MIN_OBS,
        down: sideDown,
        up: sideUp,
        comparison: compareCaptureSides(sideDown, sideUp),
        counts: {
          down: driverDown.reduce((acc, m) => acc + (m === true ? 1 : 0), 0),
          up: driverUp.reduce((acc, m) => acc + (m === true ? 1 : 0), 0),
        },
      };

      relationshipQuality = {
        contribution,
        partial,
        selfPercentile: {
          corr20: selfPercentile(corr20 ?? []),
          corr60: selfPercentile(corr60 ?? []),
        },
        captureAsymmetry,
        tail: tailCoMovement(groupReturns, driverReturns),
        stability: correlationStability(corr20 ?? []),
        driverContext: {
          trailingReturn: trailingReturnInto(driverCloses, driverCloses.length - 1, 20),
          vol: selfPercentile(rollingStd(driverReturns, 20, joinedDates) ?? []),
        },
      };
    }

    // First observation with a FULL trailing SDS baseline — the UI base-rate
    // sentence anchors here, never at the raw lookback start.
    const firstEligibleInflectionDate = divergenceSeries[SDS_BASELINE_WINDOW]?.eventDate ?? null;

    let inflections = null;
    let baseRates = null;
    const suppressed = {};
    if (joinedCloses < MIN_CLOSES_FOR_INFLECTIONS) {
      suppressed.inflections = `insufficient joined history (${joinedCloses} closes, ${MIN_CLOSES_FOR_INFLECTIONS} required)`;
    } else {
      // Change G — enrich each episode with the trailing 5-session return INTO
      // the flag (forwardReturns pointed backward): group composite levels and
      // (scaled) driver closes. Additive to the episode; forwardReturns below
      // reads only startCloseIndex/startDate/direction, so ordering is free.
      // Build 3 — contextAtFlag: the GROUP COMPOSITE's own technical state at
      // the flag (vs 50DMA, RSI-14 zone). Additive like Change G; cached
      // pre-Build-3 payloads simply lack the field and the UI null-guards it.
      inflections = detectInflections(divergenceSeries).map((ep) => ({
        ...ep,
        groupInto5d: trailingReturnInto(groupLevels, ep.startCloseIndex),
        driverInto5d: trailingReturnInto(driverCloses, ep.startCloseIndex),
        contextAtFlag: computeContextAtFlag(groupLevels, ep.startCloseIndex),
      }));
      baseRates = {
        group: forwardReturns(groupLevels, joinedDates, inflections),
        driver: forwardReturns(driverCloses, joinedDates, inflections),
        // Build 3 — conditioned base rates: GROUP forward returns partitioned
        // by each episode's own vs50DMA stamp (null stamps join neither side),
        // non-overlap walked WITHIN each partition, stats tier-gated in-data
        // (< 3 independent → counts only). Additive to the response shape.
        byCondition: conditionedBaseRates(groupLevels, joinedDates, inflections),
      };
    }

    // Change F / Build 3.1 — divergence tension gauge: the LATEST divergence
    // observation's d and SDS, plus the coherent tension `state`. The SDS score
    // stays a raw stretch measure; the `state` it maps to now applies the flag's
    // |d| LEVEL floor via the SAME shared helper the scan chips use, so a
    // high-score / small-gap latest reads 'stretched' rather than claiming a
    // break on score alone. It remains a latest-observation read (no persistence
    // gate — see tensionStateFrom), so it can still read 'break' without a
    // persisted episode; that gauge-vs-episode split is by design. Null when the
    // divergence series is empty OR inflection detection is suppressed (the gauge
    // and the regime-break card appear and disappear together). Score — and thus
    // a non-null state — is null when the last obs lacks a full baseline.
    const lastDiv =
      !suppressed.inflections && divergenceSeries.length
        ? divergenceSeries[divergenceSeries.length - 1]
        : null;
    const lastScore = lastDiv
      ? standardizedDivergenceScore(divergenceSeries, divergenceSeries.length - 1)
      : null;
    const divergence = {
      latest: lastDiv
        ? {
            d: lastDiv.d,
            score: lastScore,
            state: tensionStateFrom({ score: lastScore, d: lastDiv.d }),
            eventDate: lastDiv.eventDate,
          }
        : null,
    };

    // Headline beta = the LATEST element of the rolling series — never a
    // separately-computed point beta (the number and the line cannot disagree).
    const latestBeta = beta40 && beta40.length ? beta40[beta40.length - 1] : null;

    const payload = {
      meta: {
        group,
        droppedSymbols: failedSymbols,
        partial,
        driver: driverKey,
        driverLabel: registry.label,
        driverUnit: registry.unit,
        joinedCloses,
        lookbackDays,
        firstEligibleInflectionDate,
        computedAt: new Date().toISOString(),
        cached: false,
      },
      byWindow: {
        corr20: { value: latestValue(corr20) },
        corr60: { value: latestValue(corr60) },
      },
      beta: {
        window: BETA_WINDOW,
        latest:
          latestBeta && latestBeta.beta !== null
            ? { beta: latestBeta.beta, alpha: latestBeta.alpha, r: latestBeta.r, eventDate: latestBeta.eventDate }
            : null,
        interpretation: registry.betaInterpretation,
        unit: registry.unit,
      },
      leadLag: lag,
      divergence,
      conditional,
      cohesion,
      inflections,
      baseRates,
      suppressed,
      series: {
        corr20: (corr20 ?? []).map((e) => ({ eventDate: e.eventDate, value: e.value })),
        corr60: (corr60 ?? []).map((e) => ({ eventDate: e.eventDate, value: e.value })),
        // beta may be null per the variance guard — the UI gaps the line, never zeros it.
        beta40: (beta40 ?? []).map((e) => ({ eventDate: e.eventDate, beta: e.beta, r: e.r })),
      },
      // Additive, flag-gated: omitted entirely when the flag is off (byte-identical
      // payload); the UI null-guards it exactly like conditional/cohesion.
      ...(CORRELATION_RELATIONSHIP_QUALITY_ENABLED ? { relationshipQuality } : {}),
    };

    // ── Cache write: NON-PARTIAL ONLY; a cache failure never fails the response ──
    if (!partial) {
      try {
        const ttlMs = computeCorrelationCacheTtlMs();
        await db.collection('correlationIntelligence').doc(docId).set({
          payload,
          computedAt: payload.meta.computedAt,
          expiresAt: Date.now() + ttlMs,
          ttlMs,
        });
        setInCache(cacheKey, payload, Math.floor(ttlMs / 1000));
      } catch (cacheErr) {
        console.warn('[correlation] cache write failed:', cacheErr?.message);
      }
    }

    return res.status(200).json(payload);
  } catch (err) {
    console.error('[correlation] unexpected error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
