// api/_utils/intraday/accumulator.js
//
// Intraday Data — Build 1, contract §5.4 (the VWAP estimate and the vendor
// aggregates), §5.5 (observation classification) and §5.6 (session
// rollover). PURE, ZERO IMPORTS, no Date.now(). Every function returns a NEW
// accumulator; inputs are never mutated.
//
// Order of operations, per §5.5: numeric validation → rollover → the
// post-close rule → classification.
//
// THE POST-CLOSE RULE (calcVersion 2; EODHD's 2026-09-21 answers 1 and 2).
// Live v2 `volume`, `high` and `low` are REGULAR-SESSION quantities, and after
// 16:00 ET they stop at the session total while `lastTradePrice` /
// `lastTradeTime` — the Observation's `price` / `priceAsOf` — keep updating
// with extended-hours prints. So after the close `priceAsOf` is LATER than the
// point those aggregates reflect, and it is no longer a valid cutoff for them.
// An observation with `priceAsOf ≥ sessionCloseMs` is therefore `post_close`:
// not an anomaly (an extended-hours print is normal), and it updates NO
// session aggregate — the accumulator is returned byte-identical, so the VWAP
// estimate, `volume`, `volumePace` and `sessionHL` keep the values AND the
// cutoffs of the last pre-close accepted observation. Only the price facts
// (the latest quote) and bucket COMPLETION reflect it; its price is never
// written to a bucket (§6.2, applyObservationToBuckets). The close is the
// calendar's, so an early-close day uses 13:00 ET.
//
// The accumulator (contract §7.1, universe state):
//   { num, den, samples, lastAcceptedVolume, lastAcceptedAsOf, sessionEtDate,
//     degraded, heldObservationIds[] }
// plus two working fields this module owns: `lastAcceptedPrice` (the price a
// volume-only advance is assigned at) and `holding` (a regression is being
// held; the next accepted observation is the RESUME that assigns the gap).
//
// Known failure, stated in the definition (§5.4): all interval volume is
// assigned to the interval's last accepted price; the error is unbounded at
// sharp intra-poll moves. That is why the record is named
// `method: 'sampled_estimate'` — it is an estimate whatever the cutoff says.
// (`experimental` tracked only whether VOLUME_CUTOFF_FIELD was confirmed, and
// is false now that it is.)

import { observationId, strikeKey } from './observation.js';

export const OUTCOME = Object.freeze({
  REJECTED: 'rejected',
  PRIOR_SESSION: 'prior_session',
  UNCHANGED: 'unchanged',
  VOLUME_ONLY_ADVANCE: 'volume_only_advance',
  HELD: 'held',
  ACCEPTED: 'accepted',
  RESUMED: 'resumed',
  POST_CLOSE: 'post_close',
});

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Addendum A3 — how many held observation ids the accumulator retains.
 * §5.5 needs exactly two ("two DISTINCT held observations ... set degraded");
 * the rest were pure growth in a persisted document.
 */
export const HELD_ID_CAP = 2;

export function newAccumulator(sessionEtDate = null) {
  return {
    num: 0,
    den: 0,
    samples: 0,
    lastAcceptedVolume: null,
    lastAcceptedAsOf: null,
    lastAcceptedPrice: null,
    sessionEtDate,
    degraded: false,
    heldObservationIds: [],
    // Addendum A3 — holds this session, uncapped; the id array is capped.
    heldCount: 0,
    holding: false,
  };
}

/**
 * §5.5 numeric validation. `obsSession` is the calendar session for the ET
 * date of the observation's OWN priceAsOf (null when that date is not a
 * trading day).
 * @returns {{ok: true, volumeInvalid: boolean, hlInvalid: boolean} | {ok: false, reason: string}}
 */
export function validateObservation(obs, { obsSession, futureToleranceMs }) {
  if (!obs || !isNum(obs.priceAsOf)) return { ok: false, reason: 'price_as_of_missing' };
  if (!isNum(obs.availableAt)) return { ok: false, reason: 'available_at_missing' };
  if (obs.priceAsOf > obs.availableAt + futureToleranceMs) return { ok: false, reason: 'price_as_of_future' };
  if (!obsSession || obsSession.isTradingDay !== true) return { ok: false, reason: 'no_session_for_date' };
  if (obs.priceAsOf < obsSession.openMs) return { ok: false, reason: 'price_as_of_before_open' };
  if (!isNum(obs.price) || obs.price <= 0) return { ok: false, reason: 'price_invalid' };
  const volumeInvalid = !isNum(obs.volume) || obs.volume < 0;
  const hlInvalid = !isNum(obs.high) || !isNum(obs.low) || !isNum(obs.open);
  return { ok: true, volumeInvalid, hlInvalid };
}

/** §5.4 — the estimate; null until volume has been assigned. */
export function vwapEstimate(acc) {
  return acc && acc.den > 0 ? acc.num / acc.den : null;
}

function firstAccept(acc, obs, volumeInvalid, hlInvalid) {
  const next = { ...acc, lastAcceptedAsOf: obs.priceAsOf, lastAcceptedPrice: obs.price, holding: false };
  if (volumeInvalid) return next;
  // First accepted observation of a session: num = HLC3 × volume; den = volume.
  const typical = hlInvalid ? obs.price : (obs.high + obs.low + obs.price) / 3;
  next.num = typical * obs.volume;
  next.den = obs.volume;
  next.samples = obs.volume > 0 ? 1 : 0;
  next.lastAcceptedVolume = obs.volume;
  return next;
}

function assignDelta(acc, obs, deltaVol) {
  const next = { ...acc };
  if (deltaVol > 0) {
    next.num = acc.num + obs.price * deltaVol;
    next.den = acc.den + deltaVol;
    next.samples = acc.samples + 1;
  }
  return next;
}

/**
 * Apply one observation to a symbol's accumulator.
 *
 * @param {object|null} acc the accumulator (null → fresh)
 * @param {object} obs Observation (§4)
 * @param {object} ctx
 * @param {string} ctx.obsEtDate   ET calendar date of obs.priceAsOf
 * @param {object|null} ctx.obsSession the calendar session for obsEtDate
 * @param {object} ctx.pollSession the session the poller is running (its etDate anchors the state)
 * @param {number} ctx.futureToleranceMs
 * @returns {{ acc: object, outcome: string, reason: string|null, anomaly: string|null,
 *            rollover: boolean, volumeInvalid: boolean, hlInvalid: boolean,
 *            priceNew: boolean, observationId: string, strikeKey: string, deltaVol: number }}
 */
export function applyObservation(acc, obs, { obsEtDate, obsSession, pollSession, futureToleranceMs = 60_000 }) {
  const base = acc || newAccumulator(null);
  const oid = observationId(obs?.sym, obs?.priceAsOf, obs?.snapshotTs);
  const sk = strikeKey(obs?.sym, obs?.priceAsOf);
  const result = (outcome, extra = {}) => ({
    acc: base, outcome, reason: null, anomaly: null, rollover: false,
    volumeInvalid: false, hlInvalid: false, priceNew: false, observationId: oid, strikeKey: sk, deltaVol: 0,
    ...extra,
  });

  // 1. Numeric validation.
  const v = validateObservation(obs, { obsSession, futureToleranceMs });
  if (!v.ok) return result(OUTCOME.REJECTED, { reason: v.reason, anomaly: 'rejected' });
  const { volumeInvalid, hlInvalid } = v;

  // 2. Rollover — on the ET date of the observation's OWN priceAsOf.
  if (obsEtDate < pollSession.etDate) {
    // Yesterday's closing quote before today's first trade: normal, no update.
    return result(OUTCOME.PRIOR_SESSION, { reason: 'prior_session_quote', volumeInvalid, hlInvalid });
  }
  if (obsEtDate > pollSession.etDate) {
    return result(OUTCOME.REJECTED, { reason: 'price_as_of_after_session', anomaly: 'rejected', volumeInvalid, hlInvalid });
  }
  let cur = base;
  let rollover = false;
  if (cur.sessionEtDate !== obsEtDate) {
    // Reset BEFORE any comparison — the overnight volume reset is not an anomaly.
    rollover = cur.sessionEtDate !== null;
    cur = newAccumulator(obsEtDate);
  }

  // 3. The post-close rule (§5.5, calcVersion 2) — before every classification
  //    case, so a post-close quote is never `unchanged`, `volume_only_advance`,
  //    `held` or `accepted`. The accumulator rides through untouched (`cur` is
  //    `base` itself unless the rollover above replaced it), so every session
  //    aggregate keeps the value and the cutoff of the last PRE-CLOSE accepted
  //    observation. `priceNew` is true: the quote is the latest one, and the
  //    bucket layer needs it to establish passage past the close.
  if (obs.priceAsOf >= obsSession.closeMs) {
    return result(OUTCOME.POST_CLOSE, {
      acc: cur, rollover, volumeInvalid, hlInvalid, priceNew: true, reason: 'post_close',
    });
  }

  // 4. Classification.
  if (cur.lastAcceptedAsOf === null) {
    const next = firstAccept(cur, obs, volumeInvalid, hlInvalid);
    return result(OUTCOME.ACCEPTED, {
      acc: next, rollover, volumeInvalid, hlInvalid, priceNew: true,
      anomaly: volumeInvalid ? 'volumeInvalid' : null,
      deltaVol: volumeInvalid ? 0 : obs.volume,
    });
  }

  const sameAsOf = obs.priceAsOf === cur.lastAcceptedAsOf;
  const laterAsOf = obs.priceAsOf > cur.lastAcceptedAsOf;
  const earlierAsOf = obs.priceAsOf < cur.lastAcceptedAsOf;
  const lastVol = cur.lastAcceptedVolume;
  const volKnown = !volumeInvalid && lastVol !== null;
  const volEq = volKnown && obs.volume === lastVol;
  const volUp = volKnown && obs.volume > lastVol;
  const volDown = volKnown && obs.volume < lastVol;

  // Regressed: priceAsOf moved backwards, or cumulative volume shrank → hold.
  if (earlierAsOf || volDown) {
    const distinct = !cur.heldObservationIds.includes(oid);
    // Addendum A3 — the array is capped at HELD_ID_CAP.
    //
    // It is read in exactly two places: `.includes()` just above, and
    // `.length >= 2` just below. Two entries are all either needs, and
    // `degraded` is sticky once set, so capping is behaviour-preserving. It
    // was previously unbounded: one 16-char id per distinct held observation
    // for a whole session, persisted in intradayCalcState/{etDate}. At 255
    // symbols regressing every sweep the review measured that document at
    // 1,868,275 B — 178 % of Firestore's 1 MiB limit, which would fail the
    // publish transaction for every symbol, not just the flapping ones. The
    // §7.3 sizing run never produced a held observation, so it never saw it.
    const heldObservationIds = distinct && cur.heldObservationIds.length < HELD_ID_CAP
      ? [...cur.heldObservationIds, oid]
      : cur.heldObservationIds;
    const degraded = cur.degraded || heldObservationIds.length >= 2;
    return result(OUTCOME.HELD, {
      // `heldCount` keeps the magnitude the ids no longer carry: every hold
      // this session, uncapped, as a plain number.
      acc: { ...cur, heldObservationIds, heldCount: (cur.heldCount || 0) + 1, degraded, holding: true },
      reason: earlierAsOf ? 'price_as_of_regressed' : 'volume_regressed',
      anomaly: 'held', rollover, volumeInvalid, hlInvalid,
    });
  }

  if (sameAsOf) {
    if (volumeInvalid) {
      // Same trade, unusable volume: nothing to apply, nothing to count as new.
      return result(OUTCOME.UNCHANGED, { acc: cur, rollover, volumeInvalid, hlInvalid, anomaly: 'volumeInvalid' });
    }
    if (volEq || lastVol === null) {
      return result(OUTCOME.UNCHANGED, { acc: cur, rollover, volumeInvalid, hlInvalid });
    }
    if (volUp) {
      const delta = obs.volume - lastVol;
      const next = { ...assignDelta(cur, { price: cur.lastAcceptedPrice ?? obs.price }, delta), lastAcceptedVolume: obs.volume };
      return result(OUTCOME.VOLUME_ONLY_ADVANCE, { acc: next, rollover, volumeInvalid, hlInvalid, deltaVol: delta });
    }
  }

  // laterAsOf && volume ≥ lastAcceptedVolume (or volume unusable) → accepted.
  if (laterAsOf) {
    const resumed = cur.holding === true;
    let next = { ...cur, lastAcceptedAsOf: obs.priceAsOf, lastAcceptedPrice: obs.price, holding: false };
    let delta = 0;
    if (!volumeInvalid) {
      delta = lastVol === null ? obs.volume : obs.volume - lastVol;
      next = { ...assignDelta(next, obs, delta), lastAcceptedVolume: obs.volume };
      if (lastVol === null && obs.volume > 0) next.samples = Math.max(next.samples, 1);
    }
    return result(resumed ? OUTCOME.RESUMED : OUTCOME.ACCEPTED, {
      acc: next, rollover, volumeInvalid, hlInvalid, priceNew: true, deltaVol: delta,
      anomaly: resumed ? 'gapAssigned' : (volumeInvalid ? 'volumeInvalid' : null),
    });
  }

  // Unreachable by construction (every combination above returns); kept explicit.
  return result(OUTCOME.UNCHANGED, { acc: cur, rollover, volumeInvalid, hlInvalid });
}

/**
 * §5.4 — `volumePace`, linear pace against averageVolume over the elapsed
 * fraction of the session. `volumeCutoffAsOf` is the instant the volume is
 * cumulative to, so the elapsed time is measured AT THE VOLUME CUTOFF, never
 * at the sweep. Absent with `cutoff_unconfirmed` when there is no cutoff —
 * which, with VOLUME_CUTOFF_FIELD set, now means a symbol whose only
 * observation this session is post-close.
 */
export function computeVolumePace({ volume, averageVolume, volumeCutoffAsOf, session, volumeInvalid, minElapsedMin = 5 }) {
  if (!isNum(volumeCutoffAsOf)) return { status: 'absent', value: null, method: 'linear_pace', elapsedAtCutoffMin: null, reason: 'cutoff_unconfirmed' };
  if (volumeInvalid) return { status: 'absent', value: null, method: 'linear_pace', elapsedAtCutoffMin: null, reason: 'volume_invalid' };
  const elapsedMin = (volumeCutoffAsOf - session.openMs) / 60_000;
  const sessionLenMin = (session.closeMs - session.openMs) / 60_000;
  if (!(elapsedMin >= minElapsedMin)) return { status: 'absent', value: null, method: 'linear_pace', elapsedAtCutoffMin: elapsedMin, reason: 'insufficient_elapsed' };
  if (!isNum(averageVolume) || averageVolume <= 0) return { status: 'absent', value: null, method: 'linear_pace', elapsedAtCutoffMin: elapsedMin, reason: 'no_reference_volume' };
  const expected = averageVolume * Math.min(elapsedMin, sessionLenMin) / sessionLenMin;
  return { status: 'ready', value: volume / expected, method: 'linear_pace', elapsedAtCutoffMin: elapsedMin, reason: null };
}

/** The ms value of the Observation field a cutoff is configured to, or null. */
export function resolveCutoff(obs, field) {
  if (!field || !obs) return null;
  const v = obs[field];
  return isNum(v) ? v : null;
}
