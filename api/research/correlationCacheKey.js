/**
 * Correlation Intelligence — the deep-dive cache-key hash (extracted verbatim
 * from api/research/correlation.js so the narrate endpoint recomputes a
 * BYTE-IDENTICAL docId instead of copying the formula. BUILD_RULES §4: the cache
 * key must agree by construction — two implementations of it would drift into
 * cache misses or, worse, a narration keyed to the wrong contract.
 *
 * Pure: imports only Node's crypto. The INPUTS must already be canonical (the
 * caller owns uppercase / .US-strip / dedupe / lookback-clamp) — this is only
 * the final hash so both callers agree on that one step.
 */
import { createHash } from 'crypto';

/**
 * @param {object} p
 * @param {string[]} p.group - canonical member symbols (any order; sorted here)
 * @param {string} p.driverKey - the raw driver key (registry key or 'CUSTOM')
 * @param {string} p.customSymbol - canonical app-form custom ticker, '' for registry
 * @param {number} p.lookbackDays - clamped lookback
 * @returns {string} the sha1 docId (identical to correlation.js's deep-dive key)
 */
export function deepDiveDocId({ group, driverKey, customSymbol, lookbackDays }) {
  return createHash('sha1')
    .update([...group].sort().join(',') + '|' + driverKey + ':' + customSymbol + '|' + lookbackDays)
    .digest('hex');
}
