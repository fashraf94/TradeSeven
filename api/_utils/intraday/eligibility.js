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
//   ineligible   otherwise, with reason — including `cutoff_future`, a cutoff
//                stamped more than CUTOFF_FUTURE_TOLERANCE_MS after the check.
//
// `consumer` on every verdict names who asked (§8.2 verdict shape).

import { CONSUMER_MAX_AGE_MS, MIN_ACCUMULATOR_SAMPLES, POLICY_VERSION } from '../intradayConfig.js';

/**
 * How far a cutoff may lead the check before the age is refused (§8.3 policy).
 *
 * An age is `nowMs - cutoff`, so a cutoff AHEAD of the check makes it negative
 * and every age comparison downstream passes — `ageMs > maxAgeMs` is false at
 * any distance, so a fact stamped an hour into the future reads as the
 * freshest possible reading, for every consumer. That is the same failure
 * shape addendum A2 closed on the other side (R-3: an ageless null cutoff),
 * approached from the future rather than the past.
 *
 * 60 s covers ordinary skew between the vendor's clock, the poller's and the
 * reader's. Deliberately NOT `PRICE_AS_OF_FUTURE_TOLERANCE_MS`, which is the
 * §5.5 reject rule for priceAsOf vs availableAt at COLLECTION time and is a
 * calcVersion tunable: this one is an §8.3 policy bound, and a tune of either
 * must not silently move the other. Equal magnitude today, by coincidence of
 * what "clock skew" means, not by derivation.
 */
export const CUTOFF_FUTURE_TOLERANCE_MS = 60_000;

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
  // §8.2 puts `availableAt` on the symbol record — the instant the quote
  // behind these facts was received. Addendum A2 uses it as the age basis
  // when the indicator's own cutoff is unconfirmed.
  const availableAt = isNum(symbolFacts?.availableAt) ? symbolFacts.availableAt : null;
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

    // Addendum A2 — the age gate runs BEFORE the cutoff-null branch.
    //
    // While §15 is unanswered every vendor aggregate and the VWAP estimate
    // carry a null cutoff, and the old order returned `display_only` without
    // ever reaching the age check. Combined with §5.5's carry-forward (a
    // rejected or held observation leaves the PREVIOUS sweep's facts in the
    // snapshot) and a `collectionStalled` that measures whether the POLLER is
    // alive rather than whether the FACT is fresh, an arbitrarily old value
    // rendered as a current diagnostic — measured at 18 hours in the review
    // (R-3). Every trading morning reproduced it: on a 15-minute delayed feed
    // the first ~15 minutes of the session are all rejects or prior-session,
    // so every symbol is in carry-forward when the first check runs.
    //
    // The quote's own `availableAt` is the only instant the record carries
    // when the cutoff is null, so it is what bounds the line. Where a cutoff
    // exists it stays the measure — it is the tighter and more accurate one,
    // and §8.3's "age from the indicator's OWN cutoff" still governs.
    // Scoped deliberately: §8.3's "age from the indicator's OWN cutoff" still
    // governs wherever a cutoff exists, so this changes nothing for a
    // confirmed indicator. It is only the null-cutoff path that gains a bound.
    const ageBasis = cutoff !== null ? cutoff : availableAt;
    if (!isNum(ageBasis)) { verdicts[key] = v(VERDICT.INELIGIBLE, 'cutoff_unconfirmed'); continue; }
    const ageMs = nowMs - ageBasis;

    // THE FUTURE-CUTOFF GUARD — ahead of the age check, and so ahead of every
    // branch that reads `ageMs`, including the `display_only` ones. A basis
    // later than the check is not an age at all, and the sign is what makes it
    // dangerous: it reads as freshest-possible rather than as an error, for
    // every consumer. Applied to `ageBasis` because that IS the cutoff wherever
    // a cutoff exists, and is A2's documented stand-in for it where one does
    // not — the negative age is the same either way.
    if (-ageMs > CUTOFF_FUTURE_TOLERANCE_MS) { verdicts[key] = v(VERDICT.INELIGIBLE, 'cutoff_future', { ageMs }); continue; }
    if (ageMs > maxAgeMs) { verdicts[key] = v(VERDICT.INELIGIBLE, 'stale', { ageMs }); continue; }

    if (cutoff === null) {
      // A vendor aggregate or an experimental estimate with no confirmed cutoff:
      // displayable as such (and now only while fresh), never eligible.
      if (isDisplay && (experimental || VENDOR_AGGREGATES.has(key))) {
        verdicts[key] = v(VERDICT.DISPLAY_ONLY, 'cutoff_unconfirmed', { ageMs });
      } else {
        verdicts[key] = v(VERDICT.INELIGIBLE, 'cutoff_unconfirmed', { ageMs });
      }
      continue;
    }
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
