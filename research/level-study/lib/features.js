// research/level-study/lib/features.js
//
// LevelStory Session 5 — the feature facade: the AVAILABILITY MANIFEST (every feature carries a
// class; the pre_touch set is closed under the availability rule — a machine-checkable assertion,
// not a comment), the per-event assembler, and the knownAt stamp (Addendum §A1 rule 3: persisted
// at computation, never recomputed from revised data).
//
// pre_touch  — computable strictly before touchAt; usable by touch-time AND confirmation-time studies.
// post_touch — descriptive-only this session; BARRED from every predictive cut.
// Zero product imports.

import CONFIG from '../config.js';
import { dailyFeaturesAt } from './features-daily.js';
import { intradayFeatures, etfDirectionAtTouch, rvolBucket } from './features-intraday.js';
import { groupFeaturesAt } from './features-market.js';

// ── The manifest: feature → {class, layer}. The single source of availability truth. ──

export const FEATURE_MANIFEST = Object.freeze({
  // §4.1 intraday fingerprint
  approach_velocity: { class: 'pre_touch', layer: 'intraday' },
  rvol_approach: { class: 'pre_touch', layer: 'intraday' },
  rvol_bucket: { class: 'pre_touch', layer: 'intraday' },
  vwap_side: { class: 'pre_touch', layer: 'intraday' },
  vwap_dist: { class: 'pre_touch', layer: 'intraday' },
  consol_tightness: { class: 'pre_touch', layer: 'intraday' },
  tod_bucket: { class: 'pre_touch', layer: 'intraday' },
  gap_context: { class: 'pre_touch', layer: 'intraday' },
  // §4.2 intraday momentum quality
  path_efficiency: { class: 'pre_touch', layer: 'intraday' },
  accel_final_30m: { class: 'pre_touch', layer: 'intraday' },
  pullback_depth_max: { class: 'pre_touch', layer: 'intraday' },
  hl_progression: { class: 'pre_touch', layer: 'intraday' },
  dist_from_opening_range: { class: 'pre_touch', layer: 'intraday' },
  dist_from_session_extreme: { class: 'pre_touch', layer: 'intraday' },
  prior_probe_count: { class: 'pre_touch', layer: 'intraday' },
  vol_slope_into_touch: { class: 'pre_touch', layer: 'intraday' },
  // §4.3 higher-timeframe context (all D−1)
  weekly_trend_state: { class: 'pre_touch', layer: 'trend' },
  monthly_trend_state: { class: 'pre_touch', layer: 'trend' },
  dist_20w_sma_watr: { class: 'pre_touch', layer: 'trend' },
  dist_50w_sma_watr: { class: 'pre_touch', layer: 'trend' },
  dist_52w_high_pct: { class: 'pre_touch', layer: 'trend' },
  dist_52w_low_pct: { class: 'pre_touch', layer: 'trend' },
  weekly_hhll_state: { class: 'pre_touch', layer: 'trend' },
  monthly_hhll_state: { class: 'pre_touch', layer: 'trend' },
  daily_atr_pctile: { class: 'pre_touch', layer: 'trend' },
  range_compression_pctile: { class: 'pre_touch', layer: 'trend' },
  // §4.4 relative momentum
  ret_5d_vs_spy: { class: 'pre_touch', layer: 'relative' },
  ret_20d_vs_spy: { class: 'pre_touch', layer: 'relative' },
  ret_60d_vs_spy: { class: 'pre_touch', layer: 'relative' },
  ret_5d_vs_sector: { class: 'pre_touch', layer: 'relative' },
  ret_20d_vs_sector: { class: 'pre_touch', layer: 'relative' },
  ret_60d_vs_sector: { class: 'pre_touch', layer: 'relative' },
  beta_60d: { class: 'pre_touch', layer: 'relative' },
  beta_adj_excess_20d: { class: 'pre_touch', layer: 'relative' },
  sector_direction_at_touch: { class: 'pre_touch', layer: 'relative' },
  spy_direction_at_touch: { class: 'pre_touch', layer: 'relative' },
  // §4.5 group confirmation
  eligible_peer_count: { class: 'pre_touch', layer: 'group' },
  peer_level_event_rate_prior_5d: { class: 'pre_touch', layer: 'group' },
  peer_fresh_extreme_rate_prior_5d: { class: 'pre_touch', layer: 'group' },
  peer_confirmations_same_session_before_touch: { class: 'pre_touch', layer: 'group' }, // S6 STUB — null this session
  rs_rank_in_group: { class: 'pre_touch', layer: 'group' },
  sector_rs_vs_spy_20d: { class: 'pre_touch', layer: 'group' },
  sector_rs_vs_spy_60d: { class: 'pre_touch', layer: 'group' },
  peer_level_event_rate_next_5d: { class: 'post_touch', layer: 'group' }, // descriptive-only
  // §4.6 regime & breadth (session-level, D−1)
  momo_regime: { class: 'pre_touch', layer: 'market' },
  sector_neutral_momo_spread_20d: { class: 'pre_touch', layer: 'market' },
  raw_momo_spread_20d: { class: 'pre_touch', layer: 'market' },
  breadth_pct_above_20dma: { class: 'pre_touch', layer: 'market' },
  breadth_pct_above_50dma: { class: 'pre_touch', layer: 'market' },
  nh_nl_net_63d: { class: 'pre_touch', layer: 'market' },
  beta_appetite_20d: { class: 'pre_touch', layer: 'market' },
  vol_regime_pctile: { class: 'pre_touch', layer: 'market' },
  // §4.7 run maturity & extension (D−1)
  current_leg_origin_date: { class: 'pre_touch', layer: 'trend' },
  primary_trend_origin_date: { class: 'pre_touch', layer: 'trend' },
  base_count: { class: 'pre_touch', layer: 'trend' },
  extension_in_trend_direction_atr: { class: 'pre_touch', layer: 'trend' },
  extension_pctile: { class: 'pre_touch', layer: 'trend' },
  extension_bucket: { class: 'pre_touch', layer: 'trend' },
  // §4.8 move origin & earnings
  move_origin: { class: 'pre_touch', layer: 'catalyst' },
  sessions_since_last_earnings: { class: 'pre_touch', layer: 'catalyst' },
  sessions_to_expected_earnings: { class: 'pre_touch', layer: 'catalyst' },
  sessions_to_next_earnings_actual: { class: 'post_touch', layer: 'catalyst' }, // A3: current-state calendar, never point-in-time
  expected_vs_actual_earnings_error: { class: 'post_touch', layer: 'catalyst' }, // descriptive accuracy disclosure
});

export const PRE_TOUCH_KEYS = Object.freeze(Object.keys(FEATURE_MANIFEST).filter((k) => FEATURE_MANIFEST[k].class === 'pre_touch'));
export const POST_TOUCH_KEYS = Object.freeze(Object.keys(FEATURE_MANIFEST).filter((k) => FEATURE_MANIFEST[k].class === 'post_touch'));

/** §6.5 machine-checkable closure: every emitted key is manifest-classed, on the right side, no overlap. */
export function assertAvailabilityClosure(features) {
  for (const k of Object.keys(features.pre_touch)) {
    const m = FEATURE_MANIFEST[k];
    if (!m) throw new Error(`availability closure violated: unregistered feature '${k}'`);
    if (m.class !== 'pre_touch') throw new Error(`availability closure violated: '${k}' is ${m.class} but emitted as pre_touch`);
  }
  for (const k of Object.keys(features.post_touch)) {
    const m = FEATURE_MANIFEST[k];
    if (!m) throw new Error(`availability closure violated: unregistered feature '${k}'`);
    if (m.class !== 'post_touch') throw new Error(`availability closure violated: '${k}' is ${m.class} but emitted as post_touch`);
    if (k in features.pre_touch) throw new Error(`availability closure violated: '${k}' present in both classes`);
  }
  for (const k of PRE_TOUCH_KEYS) if (!(k in features.pre_touch)) throw new Error(`availability closure violated: pre_touch '${k}' missing from emission`);
  for (const k of POST_TOUCH_KEYS) if (!(k in features.post_touch)) throw new Error(`availability closure violated: post_touch '${k}' missing from emission`);
  return true;
}

// ── Per-event assembly ────────────────────────────────────────────────────────

function touchEtMinutesOf(event, sessionBars) {
  const epoch = Math.floor(Date.parse(event.touchAt) / 1000);
  const bar = (sessionBars || []).find((b) => b.epoch === epoch);
  if (bar) return bar.etMinutes;
  // Same-session bars share one epoch↔etMinutes offset (DST-safe within a session): infer the
  // touch minute from any session bar. Lets a bar set truncated ahead of the touch still resolve.
  const any = (sessionBars || [])[0];
  if (any) return any.etMinutes + Math.round((epoch - any.epoch) / 60);
  throw new Error(`${event.eventId}: touchAt ${event.touchAt} matches no 5-min bar of ${event.eventDate} and the session is empty`);
}

/**
 * Assemble the availability-classed feature set + knownAt-stamped context for ONE event.
 * All slicing to pre-touch / D−1 happens inside the feature modules; this function only routes.
 */
export function assembleEventFeatures({
  event, series, fiveMinByDate, sessionDates,
  spySeries = null, sectorSeries = null,
  spyFiveMinByDate = null, sectorFiveMinByDate = null,
  spyPrevCloseAdjByDate = null, sectorPrevCloseAdjByDate = null,
  marketByDate = null, peers = [], reports = [],
  dailyCache = null, // optional per-symbol Map: events sharing (eventDate, side) reuse the daily block
}) {
  const D = event.eventDate;
  const i = series.dateIndex.get(D);
  if (i == null) throw new Error(`${event.eventId}: eventDate ${D} not in the daily series`);
  const five = fiveMinByDate.get ? fiveMinByDate.get(D) : fiveMinByDate[D];
  const sessionBars = five ? five.regular : [];
  const touchEtMin = touchEtMinutesOf(event, sessionBars);

  // prior session close (approach seed + gap context), from the 5m session map — same source as S4
  const dPos = sessionDates.indexOf(D);
  const prevDate = dPos > 0 ? sessionDates[dPos - 1] : null;
  const prevFive = prevDate ? (fiveMinByDate.get ? fiveMinByDate.get(prevDate) : fiveMinByDate[prevDate]) : null;
  const prevCloseAdj = prevFive ? prevFive.sessionCloseAdj : null;

  // trailing 20 sessions with 5m data (D−20..D−1) for the time-of-day-matched RVOL baseline
  const baselineSessions = [];
  for (let p = dPos - 1; p >= 0 && baselineSessions.length < 20; p--) {
    const s = fiveMinByDate.get ? fiveMinByDate.get(sessionDates[p]) : fiveMinByDate[sessionDates[p]];
    if (s && s.regular && s.regular.length) baselineSessions.unshift(s);
  }

  const intra = intradayFeatures({
    sessionBars, touchEtMin, prevSessionCloseAdj: prevCloseAdj, atrDaily: event.atrDaily,
    side: event.side, baselineSessions, probesBeforeTouch: 0, // S4 model: touchAt is the episode's first entry
  });
  intra.rvol_bucket = rvolBucket(intra.rvol_approach);

  const dailyKey = `${i}:${event.side}`;
  const daily = (dailyCache && dailyCache.get(dailyKey))
    || dailyFeaturesAt(series, i, event.side, { spy: spySeries, sector: sectorSeries, reports });
  if (dailyCache && !dailyCache.has(dailyKey)) dailyCache.set(dailyKey, daily);

  const etfDir = (etfMap, prevMap) => {
    if (!etfMap) return null;
    const s = etfMap.get ? etfMap.get(D) : etfMap[D];
    const prev = prevMap ? (prevMap.get ? prevMap.get(D) : prevMap[D]) : null;
    return etfDirectionAtTouch(s ? s.regular : null, touchEtMin, prev);
  };

  const group = groupFeaturesAt({ series, i, peers, spy: spySeries, sector: sectorSeries });
  const market = marketByDate ? (marketByDate.get ? marketByDate.get(D) : marketByDate[D]) : null;

  const pre = {
    ...intra,
    ...pick(daily, ['weekly_trend_state', 'monthly_trend_state', 'dist_20w_sma_watr', 'dist_50w_sma_watr',
      'dist_52w_high_pct', 'dist_52w_low_pct', 'weekly_hhll_state', 'monthly_hhll_state', 'daily_atr_pctile',
      'range_compression_pctile', 'ret_5d_vs_spy', 'ret_20d_vs_spy', 'ret_60d_vs_spy', 'ret_5d_vs_sector',
      'ret_20d_vs_sector', 'ret_60d_vs_sector', 'beta_60d', 'beta_adj_excess_20d',
      'current_leg_origin_date', 'primary_trend_origin_date', 'base_count',
      'extension_in_trend_direction_atr', 'extension_pctile', 'extension_bucket',
      'move_origin', 'sessions_since_last_earnings', 'sessions_to_expected_earnings']),
    sector_direction_at_touch: etfDir(sectorFiveMinByDate, sectorPrevCloseAdjByDate),
    spy_direction_at_touch: etfDir(spyFiveMinByDate, spyPrevCloseAdjByDate),
    ...pick(group, ['eligible_peer_count', 'peer_level_event_rate_prior_5d', 'peer_fresh_extreme_rate_prior_5d',
      'peer_confirmations_same_session_before_touch', 'rs_rank_in_group', 'sector_rs_vs_spy_20d', 'sector_rs_vs_spy_60d']),
    momo_regime: market ? market.momo_regime : null,
    sector_neutral_momo_spread_20d: market ? market.sector_neutral_momo_spread_20d : null,
    raw_momo_spread_20d: market ? market.raw_momo_spread_20d : null,
    breadth_pct_above_20dma: market ? market.breadth_pct_above_20dma : null,
    breadth_pct_above_50dma: market ? market.breadth_pct_above_50dma : null,
    nh_nl_net_63d: market ? market.nh_nl_net_63d : null,
    beta_appetite_20d: market ? market.beta_appetite_20d : null,
    vol_regime_pctile: market ? market.vol_regime_pctile : null,
  };
  const post = {
    peer_level_event_rate_next_5d: group.peer_level_event_rate_next_5d,
    sessions_to_next_earnings_actual: daily.sessions_to_next_earnings_actual,
    expected_vs_actual_earnings_error: daily.expected_vs_actual_earnings_error,
  };

  const features = { pre_touch: pre, post_touch: post };
  assertAvailabilityClosure(features);

  // knownAt = end of the last bar actually used: the last pre-touch 5m bar (else the prior
  // session's final regular bar). Data-derived, deterministic — never wallclock.
  const preBars = sessionBars.filter((b) => b.etMinutes < touchEtMin);
  const lastBar = preBars.length ? preBars[preBars.length - 1]
    : (prevFive && prevFive.regular && prevFive.regular.length ? prevFive.regular[prevFive.regular.length - 1] : null);
  const knownAt = lastBar ? new Date((lastBar.epoch + 300) * 1000).toISOString() : null;

  return {
    eventId: event.eventId, symbol: event.symbol, eventDate: D, side: event.side,
    familyTier: event.familyTier, disposition: event.disposition, sequenceIndex: event.sequenceIndex,
    knownAt, configVersion: CONFIG.version,
    features,
  };
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = obj[k] ?? null;
  return out;
}
