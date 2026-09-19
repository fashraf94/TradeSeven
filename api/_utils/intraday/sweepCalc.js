// api/_utils/intraday/sweepCalc.js
//
// Intraday Data — Build 1, contract §5.3 steps 5–6: per-symbol classification,
// rollover, accumulators, session H/L/V, buckets and state, then the
// documents. PURE: the clock (`nowMs`), the calendar (`sessionOf`) and the ET
// date function (`etDateOf`) are injected; nothing here reads Date.now().
//
// The I/O halves — fetch (§5.3 steps 3–4) and publish (§7.4) — live in
// intradayFetch.js and intradayStore.js.

import { applyObservation, newAccumulator, OUTCOME } from './accumulator.js';
import { applyObservationToBuckets, newRing, newState } from './buckets.js';
import { buildSymbolFacts } from './facts.js';

export function emptyAnomalies() {
  return { rejected: 0, volumeInvalid: 0, held: 0, gapAssigned: 0, missing: 0, lateUpdateRejected: 0, shapeUnexpected: 0, unitCoerced: 0 };
}
export function emptyCounters() {
  return { fetched: 0, accepted: 0, resumed: 0, unchangedCount: 0, volumeOnlyAdvance: 0, priorSession: 0, rollover: 0, carriedForward: 0 };
}

/**
 * @param {object} p
 * @param {object} p.prevSnapshotSymbols   { [sym]: facts } from the previous snapshot (carried forward)
 * @param {object} p.universeState         { accumulators: { [sym]: acc } }
 * @param {object} p.actionableDocs        { [sym]: { ring, state, log, seedStatus } }
 * @param {object} p.observations          { [sym]: Observation } fetched this sweep
 * @param {string[]} p.missing             requested symbols absent from responses
 * @param {object} p.fetchAnomalies        adapter anomalies (shapeUnexpected, unitCoerced)
 * @param {Set<string>} p.actionableSet
 * @param {Set<string>} p.cryptoSet
 * @param {object} p.session               the poller's session (etDate, openMs, closeMs, previousEtDate)
 * @param {(ms:number)=>string} p.etDateOf
 * @param {(etDate:string)=>object|null} p.sessionOf
 * @param {number} p.nowMs
 * @param {string} p.sweepId
 * @param {number} p.generation
 * @param {object} p.config                intradayConfig constants
 */
export function runSweepCalc({
  prevSnapshotSymbols = {}, universeState, actionableDocs = {}, observations = {}, missing = [], fetchAnomalies = {},
  actionableSet, cryptoSet, session, etDateOf, sessionOf, nowMs, sweepId, generation, config,
}) {
  const anomalies = emptyAnomalies();
  const counters = emptyCounters();
  anomalies.missing += missing.length;
  anomalies.shapeUnexpected += fetchAnomalies.shapeUnexpected || 0;
  anomalies.unitCoerced += fetchAnomalies.unitCoerced || 0;

  const accumulators = { ...(universeState?.accumulators || {}) };
  const docs = {};
  for (const [sym, d] of Object.entries(actionableDocs)) docs[sym] = { ...d };
  const snapshotSymbols = { ...prevSnapshotSymbols };
  const outcomes = {};

  for (const [sym, obs] of Object.entries(observations)) {
    counters.fetched += 1;
    const isCrypto = cryptoSet?.has(sym) === true;
    const isActionable = actionableSet?.has(sym) === true;
    const obsEtDate = Number.isFinite(obs?.priceAsOf) ? etDateOf(obs.priceAsOf) : null;
    const obsSession = obsEtDate ? sessionOf(obsEtDate) : null;

    if (isCrypto) {
      // §5.7 — price facts only. The only validation is a finite price/priceAsOf.
      if (!Number.isFinite(obs?.price) || obs.price <= 0 || !Number.isFinite(obs?.priceAsOf)) {
        anomalies.rejected += 1; outcomes[sym] = { outcome: OUTCOME.REJECTED, reason: 'price_invalid' }; continue;
      }
      const res = applyObservation(null, obs, { obsEtDate: session.etDate, obsSession: session, pollSession: session, futureToleranceMs: config.PRICE_AS_OF_FUTURE_TOLERANCE_MS });
      snapshotSymbols[sym] = buildSymbolFacts({
        sym, isCrypto: true, acc: null, obs, ring: null, state: null, session,
        ids: { observationId: res.observationId, strikeKey: res.strikeKey },
        volumeInvalid: !Number.isFinite(obs.volume) || obs.volume < 0,
        hlInvalid: !Number.isFinite(obs.high) || !Number.isFinite(obs.low) || !Number.isFinite(obs.open),
        config,
      });
      counters.accepted += 1;
      outcomes[sym] = { outcome: OUTCOME.ACCEPTED, reason: null };
      continue;
    }

    const res = applyObservation(accumulators[sym] || null, obs, {
      obsEtDate, obsSession, pollSession: session, futureToleranceMs: config.PRICE_AS_OF_FUTURE_TOLERANCE_MS,
    });
    outcomes[sym] = { outcome: res.outcome, reason: res.reason };
    if (res.anomaly) anomalies[res.anomaly] = (anomalies[res.anomaly] || 0) + 1;
    if (res.rollover) counters.rollover += 1;
    switch (res.outcome) {
      case OUTCOME.ACCEPTED: counters.accepted += 1; break;
      case OUTCOME.RESUMED: counters.resumed += 1; break;
      case OUTCOME.UNCHANGED: counters.unchangedCount += 1; break;
      case OUTCOME.VOLUME_ONLY_ADVANCE: counters.volumeOnlyAdvance += 1; break;
      case OUTCOME.PRIOR_SESSION: counters.priorSession += 1; break;
      default: break;
    }
    if (res.outcome === OUTCOME.REJECTED || res.outcome === OUTCOME.PRIOR_SESSION || res.outcome === OUTCOME.HELD) {
      // Nothing applied: facts carried forward (the previous snapshot's).
      counters.carriedForward += 1;
      if (res.outcome === OUTCOME.HELD) accumulators[sym] = res.acc;
      continue;
    }
    accumulators[sym] = res.acc;

    let doc = null;
    if (isActionable) {
      doc = docs[sym] || { ring: newRing(), state: newState(), log: [], seedStatus: null };
      if (res.priceNew) {
        const b = applyObservationToBuckets({
          ring: doc.ring, state: doc.state, obs, session,
          closingRowPolicy: config.CLOSING_ROW_POLICY, maxClosed: config.SEED_MAX_BUCKETS,
        });
        if (b.rejected === 'lateUpdateRejected') anomalies.lateUpdateRejected += 1;
        doc = { ...doc, ring: b.ring, state: b.state };
      }
      docs[sym] = doc;
    }

    const facts = buildSymbolFacts({
      sym, isCrypto: false, acc: res.acc, obs, ring: doc ? doc.ring : null, state: doc ? doc.state : null, session,
      ids: { observationId: res.observationId, strikeKey: res.strikeKey },
      volumeInvalid: res.volumeInvalid, hlInvalid: res.hlInvalid, config,
    });
    snapshotSymbols[sym] = facts;

    if (isActionable) {
      // §7.1 (V1.1) log entry — one per sweep per actionable symbol observed.
      const entry = {
        sweepAt: nowMs,
        priceAsOf: obs.priceAsOf,
        snapshotTs: obs.snapshotTs ?? null,
        price: obs.price,
        estimate: facts.indicators.vwap.value,
        experimental: facts.indicators.vwap.experimental,
        estimateCutoff: facts.indicators.vwap.estimateCutoff,
        volumeCutoffAsOf: facts.indicators.vwap.volumeCutoffAsOf,
        calcVersion: config.CALC_VERSION,
        strikeKey: res.strikeKey,
        generation,
      };
      docs[sym] = { ...docs[sym], log: [...(docs[sym].log || []), entry] };
    }
  }

  // Ensure every actionable symbol has a document even if unobserved this sweep.
  for (const sym of actionableSet || []) {
    if (!docs[sym] && !cryptoSet?.has(sym)) docs[sym] = { ring: newRing(), state: newState(), log: [], seedStatus: null };
  }
  // Ensure every universe accumulator object exists for the state doc.
  for (const sym of Object.keys(accumulators)) if (!accumulators[sym]) accumulators[sym] = newAccumulator(null);

  return {
    snapshotSymbols,
    universeState: { accumulators },
    actionableDocs: docs,
    anomalies,
    counters,
    outcomes,
    sweepId,
    generation,
  };
}
