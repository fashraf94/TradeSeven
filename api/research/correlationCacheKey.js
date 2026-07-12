/**
 * Correlation Intelligence — the deep-dive cache-key rule, in ONE place.
 *
 * The docId a deep-dive writes under and the docId the narrate endpoint looks it
 * up by MUST agree, byte for byte. They drifted once (BUILD_RULES §4): the Lab's
 * /api/research/correlation call omitted lookbackDays (server-defaulted) while
 * "Explain this read" sent it explicitly, and each endpoint owned its own
 * defaulting/canonicalization rule. The durable fix returns the docId from the
 * deep dive and passes it through; this module is the ONE canonicalization +
 * defaulting + hash rule that both the deep-dive endpoint and the narrate
 * fallback derive from, so a second rule can never re-open the drift.
 *
 * Pure: imports only Node's crypto.
 */
import { createHash } from 'crypto';

// The lookback default/bounds — the ONE source (correlation.js imports these).
export const LOOKBACK = { DEFAULT: 504, MIN: 150, MAX: 1260 };
const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,9}$/; // pinned: accepts BRK.B, BF.B, hyphens
const DOC_ID_RE = /^[0-9a-f]{40}$/; // sha1 hex — a supplied docId must match before use

/**
 * The sha1 over canonical inputs. Inputs MUST already be canonical (the caller,
 * or deriveDeepDiveKey, owns uppercase / .US-strip / dedupe / lookback-clamp).
 */
export function deepDiveDocId({ group, driverKey, customSymbol, lookbackDays }) {
  return createHash('sha1')
    .update([...group].sort().join(',') + '|' + driverKey + ':' + customSymbol + '|' + lookbackDays)
    .digest('hex');
}

/**
 * Canonicalize + default a deep-dive request body → its docId (and the canonical
 * params). The SAME rule the deep-dive endpoint uses for the key it writes under,
 * so the narrate fallback can re-derive an identical key. Returns { error:<code> }
 * for a structurally-invalid request (never throws).
 *
 * @param {object} body - the raw request body ({ group, driver, customSymbol?, lookbackDays? })
 * @returns {{group,driverKey,customSymbol,lookbackDays,docId} | {error:string}}
 */
export function deriveDeepDiveKey(body = {}) {
  const b = body || {};
  const driverKey = typeof b.driver === 'string' && b.driver ? b.driver : null;
  if (!driverKey) return { error: 'invalid_driver' };
  if (!Array.isArray(b.group) || b.group.length < 1 || b.group.length > 10) return { error: 'invalid_group' };
  // Canonicalize to app-form tickers (uppercase, one trailing '.US' stripped)
  // BEFORE dedupe/hash — identical to correlation.js's group canonicalization.
  const group = [...new Set(b.group.map((s) => String(s).trim().toUpperCase().replace(/\.US$/, '')))];
  if (!group.every((s) => SYMBOL_RE.test(s))) return { error: 'invalid_symbol' };
  const customSymbol = driverKey === 'CUSTOM'
    ? String(b.customSymbol || '').trim().toUpperCase().replace(/\.US$/, '')
    : '';
  let lookbackDays = LOOKBACK.DEFAULT;
  if (b.lookbackDays !== undefined) {
    if (typeof b.lookbackDays !== 'number' || !Number.isFinite(b.lookbackDays)) return { error: 'invalid_lookback' };
    lookbackDays = Math.min(LOOKBACK.MAX, Math.max(LOOKBACK.MIN, Math.round(b.lookbackDays)));
  }
  return { group, driverKey, customSymbol, lookbackDays, docId: deepDiveDocId({ group, driverKey, customSymbol, lookbackDays }) };
}

/**
 * A client-supplied docId must be a sha1 hex string before it is used as a
 * Firestore path segment — never trust raw input as a path.
 */
export function isValidDocId(s) {
  return typeof s === 'string' && DOC_ID_RE.test(s);
}
