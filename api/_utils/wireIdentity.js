// api/_utils/wireIdentity.js
// FantasyTimes Wire — idempotency keys + payload hashing (Spec V1.5 §4.5).
//
//  • buildIdempotencyKey: `{seam}:{triggerRef}:{marketDate}` — every
//    component exists BEFORE the model call (B5). Per-seam triggerRefs are
//    assembled at the call sites from the Phase 0 §3.12 table.
//  • canonicalizeEconEvent: Neta's only pre-call identity is a free-text
//    event name from a live Sonar call; aliases of the same release must
//    converge on one slug ("CPI (YoY)" ≡ "Consumer Price Index"), and
//    unknown names must degrade to a DETERMINISTIC slug (§9 "Neta alias
//    degradation").
//  • computePayloadHash (F2-2): sha256 over a canonical serialization
//    (recursively key-sorted JSON) of the normalized facts. Computed ONCE at
//    envelope creation; replay compares the STORED hash and never re-derives
//    — key order in a rebuilt object can never manufacture a false conflict.

import { createHash } from 'node:crypto';

/** `{seam}:{triggerRef}:{marketDate}` — colon-joined, lowercase seam. */
export function buildIdempotencyKey(seam, triggerRef, marketDate) {
  if (!seam || !triggerRef || !marketDate) {
    throw new Error('buildIdempotencyKey: seam, triggerRef and marketDate are all required');
  }
  return `${seam}:${triggerRef}:${marketDate}`;
}

// ── Neta econ-event canonicalization ─────────────────────────────────────
// Keyword → canonical slug, checked in order (first hit wins). Closed at
// build; extensible by spec version. Matching runs on the lowercased,
// punctuation-stripped name.
const ECON_ALIAS_TABLE = [
  { slug: 'cpi', keywords: ['cpi', 'consumer price'] },
  { slug: 'ppi', keywords: ['ppi', 'producer price'] },
  { slug: 'pce', keywords: ['pce', 'personal consumption'] },
  { slug: 'nfp', keywords: ['nfp', 'nonfarm', 'non farm', 'payroll', 'employment situation'] },
  { slug: 'claims', keywords: ['jobless claims', 'unemployment claims', 'initial claims', 'continuing claims'] },
  { slug: 'fomc', keywords: ['fomc', 'fed funds', 'rate decision', 'federal reserve decision', 'fed decision', 'interest rate decision'] },
  { slug: 'gdp', keywords: ['gdp', 'gross domestic'] },
  { slug: 'retail_sales', keywords: ['retail sales'] },
  { slug: 'ism_mfg', keywords: ['ism manufacturing', 'manufacturing pmi'] },
  { slug: 'ism_svc', keywords: ['ism services', 'services pmi', 'non manufacturing'] },
  { slug: 'umich', keywords: ['michigan', 'consumer sentiment'] },
  { slug: 'consumer_conf', keywords: ['consumer confidence'] },
  { slug: 'jolts', keywords: ['jolts', 'job openings'] },
  { slug: 'housing_starts', keywords: ['housing starts'] },
  { slug: 'durables', keywords: ['durable goods'] },
];

/**
 * Canonicalize a free-text econ event name to a deterministic slug.
 * Known Tier-1 families converge on a fixed slug; anything else degrades to
 * a plain slugified string (deterministic per input, degraded dedup).
 */
export function canonicalizeEconEvent(name) {
  const cleaned = String(name || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')      // drop parentheticals: "CPI (YoY)" → "cpi"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!cleaned) return 'unknown';
  for (const { slug, keywords } of ECON_ALIAS_TABLE) {
    if (keywords.some((kw) => cleaned.includes(kw))) return slug;
  }
  return cleaned.replace(/\s+/g, '_').slice(0, 60);
}

// ── Canonical serialization + hash (F2-2) ────────────────────────────────

/**
 * JSON serialization with recursively sorted object keys (arrays keep
 * order — element order in tickers/figures is meaningful). Deterministic for
 * any JSON-able value regardless of construction key order.
 */
export function canonicalSerialize(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortValue(value[key]);
    }
    return out;
  }
  return value === undefined ? null : value;
}

/**
 * sha256 hex over the canonical serialization. `facts` is the normalized
 * ModelAgentFacts (or, for a projection-failed REJECT, the raw projected
 * input; or null). Called exactly once, at envelope creation (§4.5 step 3).
 */
export function computePayloadHash(facts) {
  return createHash('sha256').update(canonicalSerialize(facts ?? null)).digest('hex');
}
