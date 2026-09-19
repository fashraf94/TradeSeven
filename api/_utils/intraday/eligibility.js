// api/_utils/intraday/eligibility.js
//
// Intraday Data — Build 1, contract §8.3: `evaluateIntraday(symbolFacts,
// { nowMs, policyVersion, consumer })` → verdicts, per indicator
// independently. PURE, no Date.now() — `nowMs` is the caller's instant, so
// the verdict flips as nowMs crosses an age limit while the persisted view is
// unchanged (the build-1 test). Policy v1.
//
//   eligible     requires: cutoff !== null; age from the indicator's OWN cutoff
//                ≤ the consumer's maxAgeMs (display 45 min; stage 4 25 min);
//                status 'completed' where the consumer requires it (the bucket
//                indicators, every consumer); samples ≥ 3 for the accumulator;
//                warmupMet for the recursive indicators; not degraded; not
//                collectionStalled; experimental === false; and for stage-4
//                consumers closeQualified === true.
//   display_only experimental === true (or cutoff null on a vendor aggregate)
//                with a finite value, for the display consumer ONLY. Rendered
//                with "cutoff unconfirmed" and the QUOTE's priceAsOf shown
//                separately as "quote as of". Every non-display consumer
//                treats it as ineligible.
//   ineligible   otherwise, with reason.
//
// `consumer` on every verdict names who asked (§8.2 verdict shape).

import { CONSUMER_MAX_AGE_MS, MIN_ACCUMULATOR_SAMPLES, POLICY_VERSION } from '../intradayConfig.js';

export const CONSUMERS = Object.freeze({ DISPLAY: 'display', STAGE4: 'stage4' });
export const VERDICT = Object.freeze({ ELIGIBLE: 'eligible', INELIGIBLE: 'ineligible', DISPLAY_ONLY: 'display_only' });

const BUCKET_INDICATORS = new Set(['sma20_5m', 'macd5m', 'rsi5m']);
const VENDOR_AGGREGATES = new Set(['sessionHL', 'volume', 'volumePace']);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function hasFiniteValue(key, f) {
  const v = f?.value;
  if (key === 'sessionHL') return !!v && isNum(v.high) && isNum(v.low);
  if (key === 'macd5m') return !!v && isNum(v.line) && isNum(v.signal) && isNum(v.hist);
  return isNum(v);
}

function cutoffOf(key, f) {
  if (key === 'vwap') return isNum(f?.estimateCutoff) ? f.estimateCutoff : null;
  return isNum(f?.cutoff) ? f.cutoff : null;
}

/**
 * @param {object} symbolFacts the §8.2 symbol record (facts; verdicts ignored)
 * @param {{nowMs: number, policyVersion?: number, consumer: 'display'|'stage4'}} opts
 * @returns {{ policyVersion: number, consumer: string, verdicts: Object<string, {state, reason, consumer, ageMs?: number}> }}
 */
export function evaluateIntraday(symbolFacts, { nowMs, policyVersion = POLICY_VERSION, consumer }) {
  if (!Object.values(CONSUMERS).includes(consumer)) throw new Error(`evaluateIntraday: unknown consumer ${consumer}`);
  if (!isNum(nowMs)) throw new Error('evaluateIntraday: nowMs required');
  if (policyVersion !== 1) throw new Error(`evaluateIntraday: unsupported policyVersion ${policyVersion}`);
  const maxAgeMs = CONSUMER_MAX_AGE_MS[consumer];
  const isDisplay = consumer === CONSUMERS.DISPLAY;
  const indicators = symbolFacts?.indicators || {};
  const stalled = symbolFacts?.collectionStalled === true;
  const verdicts = {};
  const v = (state, reason, extra = {}) => ({ state, reason, consumer, ...extra });

  for (const key of ['vwap', 'sessionHL', 'volume', 'volumePace', 'sma20_5m', 'macd5m', 'rsi5m']) {
    const f = indicators[key];
    if (!f) { verdicts[key] = v(VERDICT.INELIGIBLE, 'not_in_snapshot'); continue; }
    if (f.status === 'ineligible') { verdicts[key] = v(VERDICT.INELIGIBLE, f.reason || 'ineligible_by_definition'); continue; }
    if (f.status === 'absent' || !hasFiniteValue(key, f)) { verdicts[key] = v(VERDICT.INELIGIBLE, f.reason || 'absent'); continue; }
    if (stalled) { verdicts[key] = v(VERDICT.INELIGIBLE, 'collection_stalled'); continue; }

    const cutoff = cutoffOf(key, f);
    const experimental = key === 'vwap' && f.experimental === true;
    if (cutoff === null) {
      // A vendor aggregate or an experimental estimate with no confirmed cutoff:
      // displayable as such, never eligible.
      if (isDisplay && (experimental || VENDOR_AGGREGATES.has(key))) {
        verdicts[key] = v(VERDICT.DISPLAY_ONLY, 'cutoff_unconfirmed');
      } else {
        verdicts[key] = v(VERDICT.INELIGIBLE, 'cutoff_unconfirmed');
      }
      continue;
    }
    const ageMs = nowMs - cutoff;
    if (ageMs > maxAgeMs) { verdicts[key] = v(VERDICT.INELIGIBLE, 'stale', { ageMs }); continue; }
    if (experimental) { verdicts[key] = v(isDisplay ? VERDICT.DISPLAY_ONLY : VERDICT.INELIGIBLE, isDisplay ? 'cutoff_unconfirmed' : 'experimental', { ageMs }); continue; }

    if (key === 'vwap') {
      const samples = f.quality?.samples ?? 0;
      if (samples < MIN_ACCUMULATOR_SAMPLES) { verdicts[key] = v(VERDICT.INELIGIBLE, 'insufficient_samples', { ageMs }); continue; }
      if (f.quality?.degraded === true) { verdicts[key] = v(VERDICT.INELIGIBLE, 'degraded', { ageMs }); continue; }
    }
    if (BUCKET_INDICATORS.has(key)) {
      if (f.status !== 'completed') { verdicts[key] = v(VERDICT.INELIGIBLE, 'not_completed', { ageMs }); continue; }
      if (f.quality?.warmupMet !== true) { verdicts[key] = v(VERDICT.INELIGIBLE, 'warmup', { ageMs }); continue; }
      if (!isDisplay && f.quality?.closeQualified !== true) { verdicts[key] = v(VERDICT.INELIGIBLE, 'close_unqualified', { ageMs }); continue; }
    } else if (f.status !== 'ready') {
      verdicts[key] = v(VERDICT.INELIGIBLE, 'not_ready', { ageMs }); continue;
    }
    verdicts[key] = v(VERDICT.ELIGIBLE, null, { ageMs });
  }
  return { policyVersion, consumer, verdicts };
}
