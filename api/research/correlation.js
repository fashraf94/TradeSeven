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
  MIN_CLOSES_FOR_INFLECTIONS,
} from './correlationAssembly.js';
// V2 Build 3 — break context: per-episode technical state at the flag and the
// 50DMA-conditioned base rates. breakContext.js owns THE chronological→
// newest-first order adapter for its call-only technicalCalculations use.
import { computeContextAtFlag, conditionedBaseRates } from './breakContext.js';
import { CORRELATION_DRIVERS } from './driverRegistry.js';
import { fetchAllSeries } from './fetchDriverSeries.js';
import { normalizeSymbolForEODHD } from '../_utils/symbolNormalize.js';
// api→src cross-boundary flag import (scouting-board.js precedent). Node-clean
// per BUILD_RULES §4; the unmocked handler import in
// correlation.boundary.test.js is the dependency-surface guard.
import { CORRELATION_LAB_ENABLED } from '../../src/config/featureFlags.js';

// Up to 11 EODHD fetches in 3 throttled chunks (~600ms of deliberate sleep)
// plus Firestore round-trips — heavier than scouting-board's read-only 10s.
export const config = { maxDuration: 30 };

const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,9}$/; // pinned: accepts BRK.B, BF.B, hyphens
const LOOKBACK = { DEFAULT: 504, MIN: 150, MAX: 1260 };
const BETA_WINDOW = 40;

const markCached = (payload) => ({ ...payload, meta: { ...payload.meta, cached: true } });

const latestValue = (series) => (series && series.length ? series[series.length - 1].value : null);

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
    // stays a raw stretch measure (no |d| floor / persistence — it can read
    // high without a flagged episode); the `state` it maps to applies the flag's
    // |d| floor via the SAME shared helper the scan chips use, so a high-score /
    // small-gap latest reads 'stretched' rather than falsely claiming a break —
    // the gauge can no longer show a state the flag logic refuses. Null when the
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
      inflections,
      baseRates,
      suppressed,
      series: {
        corr20: (corr20 ?? []).map((e) => ({ eventDate: e.eventDate, value: e.value })),
        corr60: (corr60 ?? []).map((e) => ({ eventDate: e.eventDate, value: e.value })),
        // beta may be null per the variance guard — the UI gaps the line, never zeros it.
        beta40: (beta40 ?? []).map((e) => ({ eventDate: e.eventDate, beta: e.beta, r: e.r })),
      },
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
