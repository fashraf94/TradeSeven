// api/_utils/intraday/facts.js
//
// Intraday Data — Build 1, contract §8.2: the per-symbol FACT blocks (the
// §8.2 symbol record WITHOUT verdicts) that the snapshot carries and the
// evaluator turns into a view. PURE, no Date.now().
//
// Status vocabulary (§8.3 reads `status`):
//   'ready'      accumulator-based value present (vwap / sessionHL / volume / volumePace)
//   'completed'  bucket-based value from completed buckets (sma20_5m / macd5m / rsi5m)
//   'absent'     no value, with `reason`
//   'ineligible' by definition (crypto vwap: no session anchor, §5.7)

import { vwapEstimate, computeVolumePace, resolveCutoff } from './accumulator.js';
import { stepSma, stepMacd, stepWilderRsi } from './stepIndicators.js';
import { indicatorQuality, BUCKET_MS } from './buckets.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export const INDICATOR_KEYS = Object.freeze(['vwap', 'sessionHL', 'volume', 'volumePace', 'sma20_5m', 'macd5m', 'rsi5m']);

/** The four session aggregates the §5.5 post-close rule freezes (the accumulator's and the vendor's). */
export const SESSION_AGGREGATE_KEYS = Object.freeze(['vwap', 'sessionHL', 'volume', 'volumePace']);

/**
 * §5.5 post-close — the shape of a session aggregate for a symbol whose only
 * observation this session is post-close, so there is no last pre-close
 * accepted observation to carry.
 *
 * Deliberately NOT re-derived from the accumulator. The carried block is the
 * ONE source for a post-close aggregate (BUILD_RULES §9): a second derivation
 * would have to reconstruct the cutoff from `lastAcceptedAsOf` and could not
 * reconstruct `sessionHL` at all — the vendor's high/low/open are not in the
 * accumulator — so the two sources would disagree the moment either moved.
 */
function postCloseAbsent(key, acc, experimental) {
  switch (key) {
    case 'vwap':
      return {
        status: 'absent', value: null, method: 'sampled_estimate', experimental,
        estimateCutoff: null, volumeCutoffAsOf: null,
        quality: { samples: acc?.samples ?? 0, degraded: acc?.degraded === true },
        reason: 'post_close',
      };
    case 'volumePace':
      return { status: 'absent', value: null, method: 'linear_pace', elapsedAtCutoffMin: null, reason: 'post_close', cutoff: null };
    default:
      return { status: 'absent', value: null, cutoff: null, reason: 'post_close' };
  }
}

function priceBlock(obs) {
  return {
    value: isNum(obs?.price) ? obs.price : null,
    priceAsOf: isNum(obs?.priceAsOf) ? obs.priceAsOf : null,
    snapshotTs: isNum(obs?.snapshotTs) ? obs.snapshotTs : null,
    previousClose: isNum(obs?.previousClose) ? obs.previousClose : null,
    change: isNum(obs?.change) ? obs.change : null,
    changePercent: isNum(obs?.changePercent) ? obs.changePercent : null,
    size: isNum(obs?.size) ? obs.size : null,
  };
}

function bucketIndicator(state, key, valueOf) {
  const quality = indicatorQuality(state, key);
  const cutoff = quality.lastCompletedKey === null ? null : quality.lastCompletedKey * BUCKET_MS + BUCKET_MS;
  const value = valueOf(state);
  const base = { cutoff, quality: { ...quality, closeLagMs: null } };
  if (value === null || value === undefined) {
    return { ...base, status: 'absent', value: null, reason: quality.warmupMet ? 'no_state' : 'warmup' };
  }
  return { ...base, status: 'completed', value, reason: null };
}

/**
 * @param {object} p
 * @param {string} p.sym
 * @param {boolean} p.isCrypto
 * @param {object|null} p.acc          accumulator (universe symbols)
 * @param {object} p.obs               the observation these facts describe (validated)
 * @param {object|null} p.ring         actionable ring (null for non-actionable)
 * @param {object|null} p.state        actionable state
 * @param {object} p.session           the poller's session
 * @param {object} p.ids               { observationId, strikeKey }
 * @param {boolean} p.volumeInvalid
 * @param {boolean} p.hlInvalid
 * @param {object} p.config            { VOLUME_CUTOFF_FIELD, HL_CUTOFF_FIELD, VOLUME_PACE_MIN_ELAPSED_MIN }
 * @param {boolean} [p.postClose]       §5.5: this observation is at or after the calendar close
 * @param {object|null} [p.carryForward] the previous snapshot's facts for this symbol (post-close only)
 */
export function buildSymbolFacts({ sym, isCrypto = false, acc, obs, ring, state, session, ids, volumeInvalid = false, hlInvalid = false, config, postClose = false, carryForward = null }) {
  const cfg = config || {};
  const price = priceBlock(obs);
  const facts = {
    sym,
    observationId: ids?.observationId ?? null,
    strikeKey: ids?.strikeKey ?? null,
    source: obs?.source ?? null,
    availableAt: isNum(obs?.availableAt) ? obs.availableAt : null,
    collectionStalled: false,
    sessionEtDate: session?.etDate ?? null,
    price,
    indicators: {},
  };
  const ind = facts.indicators;

  if (isCrypto) {
    // §5.7 — price facts only; no session anchor, no buckets.
    ind.vwap = { status: 'ineligible', value: null, method: 'n/a', experimental: false, estimateCutoff: null, volumeCutoffAsOf: null, quality: null, reason: 'no_session_anchor' };
    ind.sessionHL = hlInvalid
      ? { status: 'absent', value: null, cutoff: null, reason: 'hl_invalid' }
      : { status: 'ready', value: { high: obs.high, low: obs.low, open: obs.open }, cutoff: null, reason: null };
    ind.volume = volumeInvalid
      ? { status: 'absent', value: null, cutoff: null, reason: 'volume_invalid' }
      : { status: 'ready', value: obs.volume, cutoff: null, reason: null };
    ind.volumePace = { status: 'absent', value: null, method: 'linear_pace', elapsedAtCutoffMin: null, reason: 'no_session_anchor' };
    for (const k of ['sma20_5m', 'macd5m', 'rsi5m']) ind[k] = { status: 'absent', value: null, cutoff: null, quality: null, reason: 'no_buckets' };
    return facts;
  }

  const volumeCutoffAsOf = resolveCutoff(obs, cfg.VOLUME_CUTOFF_FIELD);
  const hlCutoff = resolveCutoff(obs, cfg.HL_CUTOFF_FIELD);
  const experimental = !cfg.VOLUME_CUTOFF_FIELD;

  if (postClose) {
    // §5.5 post-close (calcVersion 2): this quote's clock is an
    // extended-hours print, so it is not the instant `volume`, `high` or
    // `low` are cumulative to and it is not a valid cutoff for the estimate
    // either. Every session aggregate keeps the value AND the cutoff of the
    // last pre-close accepted observation — which is exactly the previous
    // snapshot's block for this symbol, carried verbatim. Only the price
    // facts above and the bucket indicators below reflect this observation.
    const carried = carryForward && carryForward.sessionEtDate === (session?.etDate ?? null)
      ? (carryForward.indicators || null)
      : null;
    for (const k of SESSION_AGGREGATE_KEYS) {
      ind[k] = carried?.[k] ? { ...carried[k] } : postCloseAbsent(k, acc, experimental);
    }
    return withBucketIndicators(facts, ind, ring, state);
  }

  const est = vwapEstimate(acc);
  ind.vwap = {
    status: est === null ? 'absent' : 'ready',
    value: est,
    method: 'sampled_estimate',
    experimental,
    estimateCutoff: volumeCutoffAsOf,
    volumeCutoffAsOf,
    quality: { samples: acc?.samples ?? 0, degraded: acc?.degraded === true },
    reason: est === null ? (volumeInvalid ? 'volume_invalid' : 'no_volume_yet') : (experimental ? 'cutoff_unconfirmed' : null),
  };
  ind.sessionHL = hlInvalid
    ? { status: 'absent', value: null, cutoff: hlCutoff, reason: 'hl_invalid' }
    : { status: 'ready', value: { high: obs.high, low: obs.low, open: obs.open }, cutoff: hlCutoff, reason: hlCutoff === null ? 'cutoff_unconfirmed' : null };
  ind.volume = volumeInvalid
    ? { status: 'absent', value: null, cutoff: volumeCutoffAsOf, reason: 'volume_invalid' }
    : { status: 'ready', value: obs.volume, cutoff: volumeCutoffAsOf, reason: volumeCutoffAsOf === null ? 'cutoff_unconfirmed' : null };
  ind.volumePace = {
    ...computeVolumePace({
      volume: obs?.volume, averageVolume: obs?.averageVolume, volumeCutoffAsOf, session, volumeInvalid,
      minElapsedMin: cfg.VOLUME_PACE_MIN_ELAPSED_MIN ?? 5,
    }),
    cutoff: volumeCutoffAsOf,
  };

  return withBucketIndicators(facts, ind, ring, state);
}

/** The three bucket-based indicators (§6), shared by the normal and post-close paths. */
function withBucketIndicators(facts, ind, ring, state) {
  if (!ring || !state) {
    for (const k of ['sma20_5m', 'macd5m', 'rsi5m']) ind[k] = { status: 'absent', value: null, cutoff: null, quality: null, reason: 'not_actionable' };
    return facts;
  }
  ind.sma20_5m = bucketIndicator(state, 'sma20_5m', (s) => stepSma.value(s.sma20));
  ind.macd5m = bucketIndicator(state, 'macd5m', (s) => stepMacd.value(s.macd));
  ind.rsi5m = bucketIndicator(state, 'rsi5m', (s) => stepWilderRsi.value(s.rsi));
  // closeLagMs of the last completed bucket, for the quality block.
  const last = [...ring.buckets].reverse().find((b) => b.status === 'completed');
  for (const k of ['sma20_5m', 'macd5m', 'rsi5m']) ind[k].quality.closeLagMs = last ? last.closeLagMs : null;
  return facts;
}
