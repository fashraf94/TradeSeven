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
import { getETDate, getMarketState, getNextMarketClose } from '../_utils/marketSchedule.js';
import {
  computeReturnsSeries,
  rollingCorrelation,
  rollingBeta,
  leadLag,
  detectInflections,
  forwardReturns,
  SDS_BASELINE_WINDOW,
} from '../_utils/correlationMath.js';
import { CORRELATION_DRIVERS } from './driverRegistry.js';
import { fetchAllSeries } from './fetchDriverSeries.js';
// api→src cross-boundary flag import (scouting-board.js precedent). Node-clean
// per BUILD_RULES §4; the unmocked handler import in
// correlation.boundary.test.js is the dependency-surface guard.
import { CORRELATION_LAB_ENABLED } from '../../src/config/featureFlags.js';

// Up to 11 EODHD fetches in 3 throttled chunks (~600ms of deliberate sleep)
// plus Firestore round-trips — heavier than scouting-board's read-only 10s.
export const config = { maxDuration: 30 };

const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,9}$/; // pinned: accepts BRK.B, BF.B, hyphens
const LOOKBACK = { DEFAULT: 504, MIN: 150, MAX: 1260 };
const MIN_CLOSES_FOR_INFLECTIONS = 300; // pinned join gate
const CORR_WINDOWS = [20, 60];
const BETA_WINDOW = 40;
const THIRTY_MIN_MS = 30 * 60 * 1000;

/**
 * Milliseconds until the pinned cache expiry (next close + 30min, two-sided).
 * getETDate() returns an ET-SHIFTED Date whose getTime() is not real epoch —
 * so the duration is computed entirely inside that frame (frame-invariant)
 * and callers convert to a real-epoch expiresAt via Date.now() + ttlMs.
 */
function computeCacheTtlMs() {
  const nowEt = getETDate();
  const { state, isEarlyClose } = getMarketState();
  let expiryEtMs;
  if (state === 'CLOSED_AFTERHOURS') {
    // Weekday non-holiday outside open hours: early-AM pre-open OR post-close.
    // Reconstruct TODAY's close in the same ET frame — in [close, close+30)
    // getNextMarketClose() has already rolled to the next session, but the
    // pinned rule says today's close + 30min still governs.
    const todayClose = new Date(nowEt);
    todayClose.setHours(isEarlyClose ? 13 : 16, 0, 0, 0);
    const todayClosePlus30 = todayClose.getTime() + THIRTY_MIN_MS;
    expiryEtMs =
      nowEt.getTime() < todayClosePlus30
        ? todayClosePlus30
        : getNextMarketClose().getTime() + THIRTY_MIN_MS;
  } else {
    // OPEN / PRE_MARKET → today's close; CLOSED_WEEKEND / CLOSED_HOLIDAY →
    // next trading day's close. getNextMarketClose is early-close-aware.
    expiryEtMs = getNextMarketClose().getTime() + THIRTY_MIN_MS;
  }
  return Math.max(60 * 1000, expiryEtMs - nowEt.getTime());
}

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
  const registry = driverKey ? CORRELATION_DRIVERS[driverKey] : null;
  if (!registry) {
    return res.status(400).json({ error: 'invalid_driver', message: 'Unknown driver key.' });
  }
  if (!Array.isArray(body.group) || body.group.length < 1 || body.group.length > 10) {
    return res.status(400).json({ error: 'invalid_group', message: 'group must be 1–10 symbols.' });
  }
  const group = [...new Set(body.group.map((s) => String(s).trim().toUpperCase()))];
  if (!group.every((s) => SYMBOL_RE.test(s))) {
    return res.status(400).json({ error: 'invalid_symbol', message: 'Invalid ticker symbol format.' });
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

  const docId = createHash('sha1')
    .update([...group].sort().join(',') + '|' + driverKey + '|' + lookbackDays)
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

    // TNX scale applies to LEVELS, before differencing (registry contract).
    const scale = registry.scale ?? 1;
    const driverScaled =
      scale === 1 ? driverAsc : driverAsc.map((r) => ({ date: r.date, close: r.close * scale }));

    // ── Inner-join ALL series on date string BEFORE returns (commodities
    //    trade on different calendars), then cap at lookbackDays closes ──
    const memberMaps = survivors.map((s) => new Map(membersAsc.get(s).map((r) => [r.date, r.close])));
    let joined = driverScaled.filter((r) => memberMaps.every((m) => m.has(r.date)));
    if (joined.length > lookbackDays) joined = joined.slice(-lookbackDays);
    const joinedCloses = joined.length;
    if (joinedCloses < 2) {
      return res.status(422).json({ error: 'no_overlapping_history', joinedCloses });
    }
    const joinedDates = joined.map((r) => r.date);
    const driverCloses = joined.map((r) => r.close);
    const memberCloses = survivors.map((s, k) => joinedDates.map((d) => memberMaps[k].get(d)));

    // ── Returns (chronological from here down) ──
    const driverReturns = computeReturnsSeries(driverCloses, registry.returnMode);
    const memberReturns = memberCloses.map((closes) => computeReturnsSeries(closes, 'pct'));
    if (!driverReturns || memberReturns.some((r) => r === null)) {
      return res.status(422).json({ error: 'degenerate_series' });
    }
    // Group composite = equal-weight mean of member daily returns (post-join).
    const groupReturns = driverReturns.map(
      (_, t) => memberReturns.reduce((acc, r) => acc + r[t], 0) / memberReturns.length
    );
    // Synthetic composite levels: length n, aligned 1:1 with joinedDates, so
    // episode closeIndexes anchor identically for group forward returns.
    const groupLevels = [100];
    for (const r of groupReturns) groupLevels.push(groupLevels[groupLevels.length - 1] * (1 + r));

    // ── Stats (per-window gate: window + 1 joined closes, else null) ──
    const [W20, W60] = CORR_WINDOWS;
    const corr20 = joinedCloses >= W20 + 1 ? rollingCorrelation(groupReturns, driverReturns, W20, joinedDates) : null;
    const corr60 = joinedCloses >= W60 + 1 ? rollingCorrelation(groupReturns, driverReturns, W60, joinedDates) : null;
    const beta40 = joinedCloses >= BETA_WINDOW + 1 ? rollingBeta(groupReturns, driverReturns, BETA_WINDOW, joinedDates) : null;
    const lag = leadLag(groupReturns, driverReturns, 5);

    // Divergence series d = corr20 − corr60, aligned by closeIndex where BOTH
    // windows have non-null values (never by raw array position).
    const divergenceSeries = [];
    if (corr20 && corr60) {
      const byCloseIndex = new Map(corr20.map((e) => [e.closeIndex, e.value]));
      for (const e of corr60) {
        const v20 = byCloseIndex.get(e.closeIndex);
        if (v20 != null && e.value != null) {
          divergenceSeries.push({
            closeIndex: e.closeIndex,
            eventDate: e.eventDate,
            d: v20 - e.value,
            corr20: v20,
            corr60: e.value,
          });
        }
      }
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
      inflections = detectInflections(divergenceSeries);
      baseRates = {
        group: forwardReturns(groupLevels, joinedDates, inflections),
        driver: forwardReturns(driverCloses, joinedDates, inflections),
      };
    }

    // Headline beta = the LATEST element of the rolling series — never a
    // separately-computed point beta (the number and the line cannot disagree).
    const latestBeta = beta40 && beta40.length ? beta40[beta40.length - 1] : null;

    const payload = {
      meta: {
        group,
        droppedSymbols: failedSymbols,
        partial,
        driver: driverKey,
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
        const ttlMs = computeCacheTtlMs();
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
